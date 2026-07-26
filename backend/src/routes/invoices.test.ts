import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

vi.mock('../lib/email.js', () => ({ sendInvoiceEmail: vi.fn() }))

vi.mock('../services/auth.service.js', async () => {
  const { getAuthContextMock } = await import('../test/authContext.js')
  return { getAuthContext: getAuthContextMock }
})

const createInvoicePaymentLinkMock = vi.fn()
const generateInvoiceMock = vi.fn()

vi.mock('../services/invoices.service.js', () => ({
  createInvoicePaymentLink: (...a: unknown[]) => createInvoicePaymentLinkMock(...a),
  generateInvoice: (...a: unknown[]) => generateInvoiceMock(...a),
  getInvoiceById: vi.fn(),
  getInvoiceSendData: vi.fn(),
  getPublicInvoice: vi.fn(),
  listInvoices: vi.fn(),
  markInvoiceSent: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}))

vi.mock('../services/clients.service.js', () => ({ updateClient: vi.fn() }))

const { default: invoicesRouter } = await import('./invoices.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext } = await import('../test/authContext.js')

const app = new Hono<{ Variables: AppVariables }>().route('/invoices', invoicesRouter)

const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const TENANT_A = '11111111-1111-1111-1111-111111111111'

async function authCookie(): Promise<string> {
  setAuthContext({ userId: 'user-1', tenantId: TENANT_A, role: 'owner', plan: 'trial', crewId: null })
  const token = await signToken({ sub: 'user-1', tenantId: TENANT_A, role: 'owner', plan: 'trial' })
  return `token=${token}`
}

describe('POST /invoices/share/:token/payment-link', () => {
  beforeEach(() => {
    createInvoicePaymentLinkMock.mockReset()
  })

  it('AC2 — returns checkout URL for a sent invoice', async () => {
    createInvoicePaymentLinkMock.mockResolvedValue({
      ok: true,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })
    const res = await app.request(`/invoices/share/${TOKEN}/payment-link`, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })
    expect(createInvoicePaymentLinkMock).toHaveBeenCalledWith(TOKEN)
  })

  it('returns 404 when token is unknown or expired', async () => {
    createInvoicePaymentLinkMock.mockResolvedValue({ ok: false, reason: 'not_found' })
    const res = await app.request(`/invoices/share/${TOKEN}/payment-link`, { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('AC8/AC9 — returns 422 when invoice is not in sent status', async () => {
    createInvoicePaymentLinkMock.mockResolvedValue({ ok: false, reason: 'invalid_status' })
    const res = await app.request(`/invoices/share/${TOKEN}/payment-link`, { method: 'POST' })
    expect(res.status).toBe(422)
  })

  it('is public — no auth cookie required', async () => {
    createInvoicePaymentLinkMock.mockResolvedValue({ ok: true, checkoutUrl: 'https://x' })
    const res = await app.request(`/invoices/share/${TOKEN}/payment-link`, { method: 'POST' })
    expect(res.status).not.toBe(401)
  })
})

const ORDER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('POST /invoices', () => {
  beforeEach(() => {
    generateInvoiceMock.mockReset()
  })

  it('creates the invoice and returns 201 — happy path', async () => {
    const invoice = { id: 'inv-1', tenant_id: TENANT_A, order_id: ORDER_ID, number: 'INV-1001', status: 'draft' }
    generateInvoiceMock.mockResolvedValue({ ok: true, invoice })

    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ invoice })
    expect(generateInvoiceMock).toHaveBeenCalledWith(TENANT_A, ORDER_ID)
  })

  it('returns 404 when the order does not exist for this tenant', async () => {
    generateInvoiceMock.mockResolvedValue({ ok: false, reason: 'not_found' })

    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })

    expect(res.status).toBe(404)
  })

  // The $0-invoice bug: an order with no real price set (e.g. a lead converted
  // with no home size captured) must never be silently invoiced.
  it('returns 422, not 201, when the order has no price set (total_price is 0)', async () => {
    generateInvoiceMock.mockResolvedValue({ ok: false, reason: 'zero_price' })

    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })

    expect(res.status).toBe(422)
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('no price set'),
    })
  })

  // Server-side parity with the contract flow's send-contract gate — the
  // frontend's eligibleOrders filter must not be the only thing preventing
  // this, since it's bypassable by a direct API call.
  it('returns 409, not 201, when the order is not completed/closed yet', async () => {
    generateInvoiceMock.mockResolvedValue({ ok: false, reason: 'invalid_status' })

    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })

    expect(res.status).toBe(409)
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('Complete the order'),
    })
  })

  it('requires auth', async () => {
    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: ORDER_ID }),
    })
    expect(res.status).toBe(401)
    expect(generateInvoiceMock).not.toHaveBeenCalled()
  })
})
