import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    WEBHOOK_SECRET: 'webhook-secret-token-123456',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

const createLeadMock = vi.fn()
const listLeadsMock = vi.fn()
const getLeadMock = vi.fn()
const updateLeadMock = vi.fn()
const markLeadLostMock = vi.fn()
const convertLeadToOrderMock = vi.fn()
const findTenantBySlugMock = vi.fn()
vi.mock('../services/leads.service.js', () => ({
  createLead: (...a: unknown[]) => createLeadMock(...a),
  listLeads: (...a: unknown[]) => listLeadsMock(...a),
  getLead: (...a: unknown[]) => getLeadMock(...a),
  updateLead: (...a: unknown[]) => updateLeadMock(...a),
  markLeadLost: (...a: unknown[]) => markLeadLostMock(...a),
  convertLeadToOrder: (...a: unknown[]) => convertLeadToOrderMock(...a),
  findTenantBySlug: (...a: unknown[]) => findTenantBySlugMock(...a),
}))

const { default: leadsRouter } = await import('./leads.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/leads', leadsRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'
const LEAD_ID = '33333333-3333-3333-3333-333333333333'
const WEBHOOK_SECRET = 'webhook-secret-token-123456'

async function authCookie(): Promise<string> {
  const token = await signToken({ sub: USER_A, tenantId: TENANT_A, role: 'dispatcher', plan: 'basic' })
  return `token=${token}`
}

beforeEach(() => {
  createLeadMock.mockReset()
  listLeadsMock.mockReset()
  getLeadMock.mockReset()
  updateLeadMock.mockReset()
  markLeadLostMock.mockReset()
  convertLeadToOrderMock.mockReset()
  findTenantBySlugMock.mockReset()
})

describe('POST /leads', () => {
  it('AC1 — creates a lead scoped to the tenant and user', async () => {
    createLeadMock.mockResolvedValue({ id: LEAD_ID, name: 'Rick', status: 'new' })
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { cookie: await authCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rick', phone: '9496329557' }),
    })
    expect(res.status).toBe(201)
    expect(createLeadMock).toHaveBeenCalledWith(TENANT_A, USER_A, expect.objectContaining({ name: 'Rick', source: 'manual' }))
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { cookie: await authCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '9496329557' }),
    })
    expect(res.status).toBe(400)
    expect(createLeadMock).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rick' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /leads', () => {
  it('AC4 — lists leads for the tenant with filters', async () => {
    listLeadsMock.mockResolvedValue([{ id: LEAD_ID }])
    const res = await app.request('/leads?status=new&search=rick', { headers: { cookie: await authCookie() } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ leads: [{ id: LEAD_ID }] })
    expect(listLeadsMock).toHaveBeenCalledWith(TENANT_A, { status: 'new', search: 'rick' })
  })
})

describe('GET /leads/:id', () => {
  it('returns 404 when the lead is not in this tenant', async () => {
    getLeadMock.mockResolvedValue(null)
    const res = await app.request(`/leads/${LEAD_ID}`, { headers: { cookie: await authCookie() } })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /leads/:id', () => {
  it('AC2 — updates a lead status', async () => {
    updateLeadMock.mockResolvedValue({ id: LEAD_ID, status: 'contacted' })
    const res = await app.request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { cookie: await authCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'contacted' }),
    })
    expect(res.status).toBe(200)
    expect(updateLeadMock).toHaveBeenCalledWith(TENANT_A, LEAD_ID, { status: 'contacted' })
  })

  it('rejects an invalid status', async () => {
    const res = await app.request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { cookie: await authCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    expect(res.status).toBe(400)
    expect(updateLeadMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /leads/:id', () => {
  it('AC3 — soft-deletes by marking the lead lost', async () => {
    markLeadLostMock.mockResolvedValue({ id: LEAD_ID, status: 'lost' })
    const res = await app.request(`/leads/${LEAD_ID}`, { method: 'DELETE', headers: { cookie: await authCookie() } })
    expect(res.status).toBe(200)
    expect(markLeadLostMock).toHaveBeenCalledWith(TENANT_A, LEAD_ID)
  })
})

describe('POST /leads/:id/convert', () => {
  it('AC5/AC7 — converts a lead and returns the new order id', async () => {
    convertLeadToOrderMock.mockResolvedValue({ orderId: 'order-9' })
    const res = await app.request(`/leads/${LEAD_ID}/convert`, { method: 'POST', headers: { cookie: await authCookie() } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ orderId: 'order-9' })
    expect(convertLeadToOrderMock).toHaveBeenCalledWith(TENANT_A, USER_A, LEAD_ID)
  })

  it('returns 404 when the lead does not exist', async () => {
    convertLeadToOrderMock.mockResolvedValue(null)
    const res = await app.request(`/leads/${LEAD_ID}/convert`, { method: 'POST', headers: { cookie: await authCookie() } })
    expect(res.status).toBe(404)
  })
})

describe('POST /leads/webhook (public)', () => {
  it('AC12 — rejects requests without the correct secret', async () => {
    const res = await app.request('/leads/webhook?secret=wrong', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant_slug: 'best-movers', name: 'Rick' }),
    })
    expect(res.status).toBe(401)
    expect(createLeadMock).not.toHaveBeenCalled()
  })

  it('AC11 — creates a lead with source=zapier, normalizing field names', async () => {
    findTenantBySlugMock.mockResolvedValue({ id: TENANT_A })
    createLeadMock.mockResolvedValue({ id: LEAD_ID })
    const res = await app.request(`/leads/webhook?secret=${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenant_slug: 'best-movers',
        full_name: 'Rick Adams',
        phone_number: '9496329557',
        email_address: 'rick@example.com',
        pickup_address: 'Irvine, CA',
        delivery_address: 'Anaheim, CA',
        date: '2026-07-20',
        message: 'ASAP',
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, leadId: LEAD_ID })
    expect(createLeadMock).toHaveBeenCalledWith(
      TENANT_A,
      null,
      expect.objectContaining({
        name: 'Rick Adams',
        phone: '9496329557',
        email: 'rick@example.com',
        fromAddress: 'Irvine, CA',
        toAddress: 'Anaheim, CA',
        moveDate: '2026-07-20',
        notes: 'ASAP',
        source: 'zapier',
      }),
    )
  })

  it('returns 400 when tenant_slug is missing', async () => {
    const res = await app.request(`/leads/webhook?secret=${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rick' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the tenant slug is unknown', async () => {
    findTenantBySlugMock.mockResolvedValue(null)
    const res = await app.request(`/leads/webhook?secret=${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant_slug: 'nope', name: 'Rick' }),
    })
    expect(res.status).toBe(404)
  })
})
