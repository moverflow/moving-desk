import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

const getCrewJobsMock = vi.fn()
const getCrewJobMock = vi.fn()
const setCrewJobStatusMock = vi.fn()
vi.mock('../services/crew.service.js', () => ({
  getCrewJobs: (...args: unknown[]) => getCrewJobsMock(...args),
  getCrewJob: (...args: unknown[]) => getCrewJobMock(...args),
  setCrewJobStatus: (...args: unknown[]) => setCrewJobStatusMock(...args),
}))

const listOrderFilesMock = vi.fn()
vi.mock('../services/files.service.js', () => ({
  listOrderFiles: (...args: unknown[]) => listOrderFilesMock(...args),
}))

const sendOrderCompletedEmailMock = vi.fn()
vi.mock('../services/orders.service.js', () => ({
  sendOrderCompletedEmail: (...args: unknown[]) => sendOrderCompletedEmailMock(...args),
}))

vi.mock('../lib/r2.js', () => ({
  resolveOrderFileUrl: (key: string) => `https://files.example.com/${key}`,
}))

const { default: crewRouter } = await import('./crew.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/crew', crewRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const CREW_A = '22222222-2222-2222-2222-222222222222'
const ORDER_ID = '33333333-3333-3333-3333-333333333333'

async function crewCookie(crewId: string | undefined = CREW_A): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId: TENANT_A, role: 'crew', plan: 'basic', crewId })
  return `token=${token}`
}

async function roleCookie(role: 'owner' | 'dispatcher'): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId: TENANT_A, role, plan: 'basic' })
  return `token=${token}`
}

beforeEach(() => {
  getCrewJobsMock.mockReset()
  getCrewJobMock.mockReset()
  setCrewJobStatusMock.mockReset()
  listOrderFilesMock.mockReset()
  sendOrderCompletedEmailMock.mockReset()
  sendOrderCompletedEmailMock.mockResolvedValue(undefined)
})

describe('GET /crew/jobs', () => {
  it('AC1 — returns this crew\'s jobs, scoped by tenant + crew', async () => {
    const jobs = [{ id: ORDER_ID, status: 'confirmed', moveDate: '2026-07-18' }]
    getCrewJobsMock.mockResolvedValue(jobs)

    const res = await app.request('/crew/jobs', { headers: { cookie: await crewCookie() } })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs })
    expect(getCrewJobsMock).toHaveBeenCalledWith(TENANT_A, CREW_A)
  })

  it('returns 401 without an auth cookie', async () => {
    const res = await app.request('/crew/jobs')
    expect(res.status).toBe(401)
    expect(getCrewJobsMock).not.toHaveBeenCalled()
  })

  it('AC6 — owner cannot access crew jobs (403)', async () => {
    const res = await app.request('/crew/jobs', { headers: { cookie: await roleCookie('owner') } })
    expect(res.status).toBe(403)
    expect(getCrewJobsMock).not.toHaveBeenCalled()
  })

  it('AC6 — dispatcher cannot access crew jobs (403)', async () => {
    const res = await app.request('/crew/jobs', { headers: { cookie: await roleCookie('dispatcher') } })
    expect(res.status).toBe(403)
  })

  it('returns empty jobs when the crew user has no crewId', async () => {
    const token = await signToken({ sub: 'user-1', tenantId: TENANT_A, role: 'crew', plan: 'basic' })
    const res = await app.request('/crew/jobs', { headers: { cookie: `token=${token}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs: [] })
    expect(getCrewJobsMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /crew/jobs/:id/status', () => {
  it('AC2 — accepts in_progress', async () => {
    setCrewJobStatusMock.mockResolvedValue({ id: ORDER_ID, status: 'in_progress' })
    const res = await app.request(`/crew/jobs/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: { cookie: await crewCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: 'in_progress' })
    expect(setCrewJobStatusMock).toHaveBeenCalledWith(TENANT_A, CREW_A, ORDER_ID, 'in_progress')
    expect(sendOrderCompletedEmailMock).not.toHaveBeenCalled()
  })

  it('AC2 — rejects statuses other than in_progress/completed (422)', async () => {
    const res = await app.request(`/crew/jobs/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: { cookie: await crewCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    expect(res.status).toBe(422)
    expect(setCrewJobStatusMock).not.toHaveBeenCalled()
  })

  it('completing an order triggers the completed email', async () => {
    setCrewJobStatusMock.mockResolvedValue({ id: ORDER_ID, status: 'completed' })
    const res = await app.request(`/crew/jobs/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: { cookie: await crewCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(res.status).toBe(200)
    expect(sendOrderCompletedEmailMock).toHaveBeenCalledWith(TENANT_A, ORDER_ID)
  })

  it('AC3 — returns 404 when the order is not this crew\'s (service returns null)', async () => {
    setCrewJobStatusMock.mockResolvedValue(null)
    const res = await app.request(`/crew/jobs/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: { cookie: await crewCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    })
    expect(res.status).toBe(404)
    expect(sendOrderCompletedEmailMock).not.toHaveBeenCalled()
  })

  it('AC6 — owner cannot update crew job status (403)', async () => {
    const res = await app.request(`/crew/jobs/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: { cookie: await roleCookie('owner'), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /crew/jobs/:id/files', () => {
  it('returns files for a job that belongs to the crew', async () => {
    getCrewJobMock.mockResolvedValue({ id: ORDER_ID })
    listOrderFilesMock.mockResolvedValue([{ id: 'f1', name: 'contract.pdf', key: 'k1' }])

    const res = await app.request(`/crew/jobs/${ORDER_ID}/files`, {
      headers: { cookie: await crewCookie() },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      files: [{ id: 'f1', name: 'contract.pdf', url: 'https://files.example.com/k1' }],
    })
  })

  it('returns 404 when the job is not this crew\'s', async () => {
    getCrewJobMock.mockResolvedValue(null)
    const res = await app.request(`/crew/jobs/${ORDER_ID}/files`, {
      headers: { cookie: await crewCookie() },
    })
    expect(res.status).toBe(404)
    expect(listOrderFilesMock).not.toHaveBeenCalled()
  })
})
