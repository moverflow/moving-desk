import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
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

const createInvoicePaymentLinkMock = vi.fn()

vi.mock('../services/invoices.service.js', () => ({
  createInvoicePaymentLink: (...a: unknown[]) => createInvoicePaymentLinkMock(...a),
  generateInvoice: vi.fn(),
  getInvoiceById: vi.fn(),
  getInvoiceSendData: vi.fn(),
  getPublicInvoice: vi.fn(),
  listInvoices: vi.fn(),
  markInvoiceSent: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}))

vi.mock('../services/clients.service.js', () => ({ updateClient: vi.fn() }))

const { default: invoicesRouter } = await import('./invoices.js')

const app = new Hono().route('/invoices', invoicesRouter)

const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

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
