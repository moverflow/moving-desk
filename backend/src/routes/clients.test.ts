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

const createClientMock = vi.fn()
vi.mock('../services/clients.service.js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
  listClients: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
}))

const { default: clientsRouter } = await import('./clients.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/clients', clientsRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'

async function authCookie(tenantId = TENANT_A): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId, role: 'owner', plan: 'trial' })
  return `token=${token}`
}

beforeEach(() => {
  createClientMock.mockReset()
})

describe('POST /clients', () => {
  it('creates a client and returns 201 — happy path', async () => {
    const client = { id: 'client-1', tenant_id: TENANT_A, name: 'Jane Doe', phone: '5551234' }
    createClientMock.mockResolvedValue(client)

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ name: 'Jane Doe', phone: '5551234' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { client: typeof client }
    expect(body.client).toEqual(client)
    expect(createClientMock).toHaveBeenCalledWith(TENANT_A, { name: 'Jane Doe', phone: '5551234' })
  })

  it('rejects a name shorter than 2 characters with 400', async () => {
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ name: 'J' }),
    })
    expect(res.status).toBe(400)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('rejects a missing name with 400', async () => {
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ phone: '5551234' }),
    })
    expect(res.status).toBe(400)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jane Doe' }),
    })
    expect(res.status).toBe(401)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('rejects a request with an invalid token with 401', async () => {
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'token=not-a-real-jwt' },
      body: JSON.stringify({ name: 'Jane Doe' }),
    })
    expect(res.status).toBe(401)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the service reports a duplicate phone', async () => {
    createClientMock.mockResolvedValue(null)
    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ name: 'Jane Doe', phone: '5551234' }),
    })
    expect(res.status).toBe(409)
  })

  it('always scopes creation to the tenantId from the JWT, ignoring any tenantId in the body', async () => {
    const client = { id: 'client-2', tenant_id: TENANT_A, name: 'Bob' }
    createClientMock.mockResolvedValue(client)
    const rogueTenant = '99999999-9999-9999-9999-999999999999'

    const res = await app.request('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie(TENANT_A) },
      body: JSON.stringify({ name: 'Bob', tenantId: rogueTenant }),
    })

    expect(res.status).toBe(201)
    expect(createClientMock).toHaveBeenCalledWith(TENANT_A, { name: 'Bob' })
  })
})
