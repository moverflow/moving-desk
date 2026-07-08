import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
    JWT_EXPIRES_IN: '7d',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    STRIPE_BASIC_PRICE_ID: 'price_basic',
    STRIPE_PRO_PRICE_ID: 'price_pro',
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY_ID: 'test-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://pub.example.com',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}))

const listCrewsMock = vi.fn()
const createCrewMock = vi.fn()
const updateCrewMock = vi.fn()
const deactivateCrewMock = vi.fn()
vi.mock('../services/crews.service.js', () => ({
  listCrews: (...args: unknown[]) => listCrewsMock(...args),
  createCrew: (...args: unknown[]) => createCrewMock(...args),
  updateCrew: (...args: unknown[]) => updateCrewMock(...args),
  deactivateCrew: (...args: unknown[]) => deactivateCrewMock(...args),
}))

const { default: crewsRouter } = await import('./crews.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/crews', crewsRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'

async function authCookie(tenantId = TENANT_A): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId, role: 'owner', plan: 'trial' })
  return `token=${token}`
}

beforeEach(() => {
  listCrewsMock.mockReset()
  createCrewMock.mockReset()
  updateCrewMock.mockReset()
  deactivateCrewMock.mockReset()
})

describe('GET /crews', () => {
  it('returns the list of crews — happy path', async () => {
    const list = [
      { id: 'crew-1', tenant_id: TENANT_A, name: 'Team A', truck_label: 'Truck #3', phone: '9495550100', active: true },
    ]
    listCrewsMock.mockResolvedValue(list)

    const res = await app.request('/crews', {
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { crews: typeof list }
    expect(body.crews).toEqual(list)
    expect(listCrewsMock).toHaveBeenCalledWith(TENANT_A, false)
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request('/crews')
    expect(res.status).toBe(401)
    expect(listCrewsMock).not.toHaveBeenCalled()
  })

  it('passes includeInactive=true through when the query param is set', async () => {
    listCrewsMock.mockResolvedValue([])

    const res = await app.request('/crews?includeInactive=true', {
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(listCrewsMock).toHaveBeenCalledWith(TENANT_A, true)
  })
})

describe('POST /crews', () => {
  it('creates a crew with phone and returns 201 — happy path', async () => {
    const crew = {
      id: 'crew-1',
      tenant_id: TENANT_A,
      name: 'Team A',
      truck_label: 'Truck #3',
      phone: '9495550100',
      active: true,
    }
    createCrewMock.mockResolvedValue(crew)

    const res = await app.request('/crews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ name: 'Team A', truckLabel: 'Truck #3', phone: '9495550100' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { crew: typeof crew }
    expect(body.crew).toEqual(crew)
    expect(createCrewMock).toHaveBeenCalledWith(TENANT_A, 'Team A', 'Truck #3', '9495550100')
  })

  it('rejects a missing name with 400', async () => {
    const res = await app.request('/crews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ truckLabel: 'Truck #3', phone: '9495550100' }),
    })
    expect(res.status).toBe(400)
    expect(createCrewMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request('/crews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team A' }),
    })
    expect(res.status).toBe(401)
    expect(createCrewMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /crews/:id', () => {
  it('updates the phone field and returns 200 — happy path', async () => {
    const updated = {
      id: 'crew-1',
      tenant_id: TENANT_A,
      name: 'Team A',
      truck_label: 'Truck #3',
      phone: '9495550199',
      active: true,
    }
    updateCrewMock.mockResolvedValue(updated)

    const res = await app.request('/crews/crew-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ phone: '9495550199' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { crew: typeof updated }
    expect(body.crew).toEqual(updated)
    expect(updateCrewMock).toHaveBeenCalledWith(TENANT_A, 'crew-1', {
      name: undefined,
      truckLabel: undefined,
      phone: '9495550199',
      active: undefined,
    })
  })

  it('toggles active to false and returns 200', async () => {
    const updated = {
      id: 'crew-1',
      tenant_id: TENANT_A,
      name: 'Team A',
      truck_label: 'Truck #3',
      phone: '9495550199',
      active: false,
    }
    updateCrewMock.mockResolvedValue(updated)

    const res = await app.request('/crews/crew-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ active: false }),
    })

    expect(res.status).toBe(200)
    expect(updateCrewMock).toHaveBeenCalledWith(TENANT_A, 'crew-1', {
      name: undefined,
      truckLabel: undefined,
      phone: undefined,
      active: false,
    })
  })

  it('returns 404 when the crew is not found for this tenant', async () => {
    updateCrewMock.mockResolvedValue(null)

    const res = await app.request('/crews/crew-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ phone: '9495550199' }),
    })

    expect(res.status).toBe(404)
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request('/crews/crew-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9495550199' }),
    })
    expect(res.status).toBe(401)
    expect(updateCrewMock).not.toHaveBeenCalled()
  })

  it('does not leak another tenant crew — not-found-for-this-tenant returns 404, not the other tenant data', async () => {
    // updateCrew's WHERE clause (and(eq(id), eq(tenant_id))) is the isolation boundary:
    // a crew belonging to a different tenant simply doesn't match, so the service resolves null.
    updateCrewMock.mockResolvedValue(null)
    const tenantB = '22222222-2222-2222-2222-222222222222'

    const res = await app.request('/crews/other-tenants-crew', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie(tenantB) },
      body: JSON.stringify({ phone: '9495550199' }),
    })

    expect(res.status).toBe(404)
    expect(updateCrewMock).toHaveBeenCalledWith(tenantB, 'other-tenants-crew', {
      name: undefined,
      truckLabel: undefined,
      phone: '9495550199',
      active: undefined,
    })
  })
})
