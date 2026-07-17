import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    STRIPE_BASIC_PRICE_ID: 'price_basic',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

vi.mock('../lib/stripe.js', () => ({ stripe: {} }))

const markInvoicePaidFromSessionMock = vi.fn()
vi.mock('./invoices.service.js', () => ({
  markInvoicePaidFromSession: (...a: unknown[]) => markInvoicePaidFromSessionMock(...a),
}))

const sendPaymentConfirmationEmailMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendPaymentConfirmationEmail: (...a: unknown[]) => sendPaymentConfirmationEmailMock(...a),
}))

const { handleWebhookEvent } = await import('./billing.service.js')

function checkoutEvent(session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: { object: session as Stripe.Checkout.Session },
  } as Stripe.Event
}

const PAID_INFO = {
  number: 'INV-1089',
  moveDate: 'Jun 15, 2026',
  clientEmail: 'rick@example.com',
  clientName: 'Rick Adams',
  companyName: 'Best Movers',
  amount: 480,
}

describe('handleWebhookEvent — checkout.session.completed', () => {
  beforeEach(() => {
    markInvoicePaidFromSessionMock.mockReset()
    sendPaymentConfirmationEmailMock.mockReset()
  })

  it('AC12 — marks invoice paid and emails the client', async () => {
    markInvoicePaidFromSessionMock.mockResolvedValue(PAID_INFO)
    await handleWebhookEvent(
      checkoutEvent({
        payment_status: 'paid',
        payment_intent: 'pi_123',
        amount_total: 48000,
        metadata: { invoiceId: 'inv-1', tenantId: 't-1', orderId: 'o-1' },
      }),
    )
    expect(markInvoicePaidFromSessionMock).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      paymentIntentId: 'pi_123',
      amountTotal: 48000,
    })
    expect(sendPaymentConfirmationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'rick@example.com', amount: 480, invoiceNumber: 'INV-1089' }),
    )
  })

  it('ignores sessions that are not paid', async () => {
    await handleWebhookEvent(
      checkoutEvent({ payment_status: 'unpaid', metadata: { invoiceId: 'inv-1' } }),
    )
    expect(markInvoicePaidFromSessionMock).not.toHaveBeenCalled()
  })

  it('ignores subscription checkouts (no invoiceId in metadata)', async () => {
    await handleWebhookEvent(
      checkoutEvent({ payment_status: 'paid', metadata: { tenantId: 't-1' } }),
    )
    expect(markInvoicePaidFromSessionMock).not.toHaveBeenCalled()
  })

  it('AC14 — idempotent: no email when invoice was already paid', async () => {
    markInvoicePaidFromSessionMock.mockResolvedValue(null)
    await handleWebhookEvent(
      checkoutEvent({
        payment_status: 'paid',
        payment_intent: 'pi_123',
        amount_total: 48000,
        metadata: { invoiceId: 'inv-1' },
      }),
    )
    expect(markInvoicePaidFromSessionMock).toHaveBeenCalled()
    expect(sendPaymentConfirmationEmailMock).not.toHaveBeenCalled()
  })

  it('does not email when client has no email address', async () => {
    markInvoicePaidFromSessionMock.mockResolvedValue({ ...PAID_INFO, clientEmail: null })
    await handleWebhookEvent(
      checkoutEvent({
        payment_status: 'paid',
        payment_intent: 'pi_123',
        amount_total: 48000,
        metadata: { invoiceId: 'inv-1' },
      }),
    )
    expect(sendPaymentConfirmationEmailMock).not.toHaveBeenCalled()
  })
})
