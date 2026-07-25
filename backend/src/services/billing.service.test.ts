import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    STRIPE_BASIC_PRICE_ID: 'price_basic',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  },
}))

const loggerMock = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
vi.mock('../lib/logger.js', () => ({ logger: loggerMock }))

// handleSubscriptionUpsert reads/writes subscriptions+tenants directly (not through
// invoices.service.js). Selects resolve to `undefined` (no matching subscription row)
// by default — fine for every test here except the priceId-mismatch one, which only
// asserts on the logger call, not on the resulting DB write.
const { updateSets } = vi.hoisted(() => ({ updateSets: [] as unknown[] }))
vi.mock('../db/index.js', () => {
  function chain(): unknown {
    const c = {
      from: () => c,
      where: () => c,
      limit: () => Promise.resolve([]),
    }
    return c
  }
  return {
    db: {
      select: () => chain(),
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return { where: () => Promise.resolve([]) }
        },
      }),
    },
  }
})

vi.mock('../lib/stripe.js', () => ({ stripe: {} }))

const markInvoicePaidFromSessionMock = vi.fn()
const markInvoiceRefundedMock = vi.fn()
const markInvoiceDisputedMock = vi.fn()
const clearInvoiceCheckoutSessionMock = vi.fn()
vi.mock('./invoices.service.js', () => ({
  markInvoicePaidFromSession: (...a: unknown[]) => markInvoicePaidFromSessionMock(...a),
  markInvoiceRefunded: (...a: unknown[]) => markInvoiceRefundedMock(...a),
  markInvoiceDisputed: (...a: unknown[]) => markInvoiceDisputedMock(...a),
  clearInvoiceCheckoutSession: (...a: unknown[]) => clearInvoiceCheckoutSessionMock(...a),
}))

const claimStripeEventMock = vi.fn()
vi.mock('./stripe-events.service.js', () => ({
  claimStripeEvent: (...a: unknown[]) => claimStripeEventMock(...a),
}))

const sendPaymentConfirmationEmailMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendPaymentConfirmationEmail: (...a: unknown[]) => sendPaymentConfirmationEmailMock(...a),
}))

const { handleWebhookEvent } = await import('./billing.service.js')

function makeEvent(type: string, object: Record<string, unknown>, id = 'evt_1'): Stripe.Event {
  return { id, type, created: 1_700_000_000, data: { object } } as unknown as Stripe.Event
}

function checkoutEvent(session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return makeEvent('checkout.session.completed', session as Record<string, unknown>)
}

const PAID_INFO = {
  number: 'INV-1089',
  moveDate: 'Jun 15, 2026',
  clientEmail: 'rick@example.com',
  clientName: 'Rick Adams',
  companyName: 'Best Movers',
  amount: 480,
}

beforeEach(() => {
  markInvoicePaidFromSessionMock.mockReset()
  markInvoiceRefundedMock.mockReset()
  markInvoiceDisputedMock.mockReset()
  clearInvoiceCheckoutSessionMock.mockReset()
  sendPaymentConfirmationEmailMock.mockReset()
  claimStripeEventMock.mockReset().mockResolvedValue('process')
  updateSets.length = 0
  loggerMock.error.mockReset()
  loggerMock.warn.mockReset()
})

describe('handleWebhookEvent — checkout.session.completed', () => {
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

  it('ignores sessions that are not paid (pending async payment)', async () => {
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

describe('handleWebhookEvent — S1 async/expired/refund/dispute', () => {
  it('checkout.session.async_payment_succeeded marks the invoice paid, same as a synchronous payment', async () => {
    markInvoicePaidFromSessionMock.mockResolvedValue(PAID_INFO)
    await handleWebhookEvent(
      makeEvent('checkout.session.async_payment_succeeded', {
        payment_intent: 'pi_123',
        amount_total: 48000,
        metadata: { invoiceId: 'inv-1' },
      }),
    )
    expect(markInvoicePaidFromSessionMock).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      paymentIntentId: 'pi_123',
      amountTotal: 48000,
    })
  })

  it('checkout.session.async_payment_failed clears the stale session id, does not mark paid', async () => {
    await handleWebhookEvent(
      makeEvent('checkout.session.async_payment_failed', {
        id: 'cs_1',
        metadata: { invoiceId: 'inv-1' },
      }),
    )
    expect(markInvoicePaidFromSessionMock).not.toHaveBeenCalled()
    expect(clearInvoiceCheckoutSessionMock).toHaveBeenCalledWith('inv-1')
  })

  it('checkout.session.expired clears the stale session id, does not mark paid', async () => {
    await handleWebhookEvent(
      makeEvent('checkout.session.expired', { id: 'cs_1', metadata: { invoiceId: 'inv-1' } }),
    )
    expect(markInvoicePaidFromSessionMock).not.toHaveBeenCalled()
    expect(clearInvoiceCheckoutSessionMock).toHaveBeenCalledWith('inv-1')
  })

  it('charge.refunded marks the invoice refunded by payment_intent', async () => {
    await handleWebhookEvent(makeEvent('charge.refunded', { payment_intent: 'pi_123' }))
    expect(markInvoiceRefundedMock).toHaveBeenCalledWith('pi_123')
  })

  it('charge.refunded no-ops when there is no payment_intent on the charge', async () => {
    await handleWebhookEvent(makeEvent('charge.refunded', { payment_intent: null }))
    expect(markInvoiceRefundedMock).not.toHaveBeenCalled()
  })

  it('charge.dispute.created marks the invoice disputed by payment_intent', async () => {
    await handleWebhookEvent(makeEvent('charge.dispute.created', { payment_intent: 'pi_123' }))
    expect(markInvoiceDisputedMock).toHaveBeenCalledWith('pi_123')
  })
})

describe('handleWebhookEvent — S3 idempotency/ordering ledger', () => {
  it('skips processing entirely when claimStripeEvent reports a duplicate', async () => {
    claimStripeEventMock.mockResolvedValue('duplicate')
    markInvoicePaidFromSessionMock.mockResolvedValue(PAID_INFO)
    await handleWebhookEvent(
      checkoutEvent({ payment_status: 'paid', metadata: { invoiceId: 'inv-1' } }),
    )
    expect(markInvoicePaidFromSessionMock).not.toHaveBeenCalled()
  })

  it('skips processing entirely when claimStripeEvent reports the event as stale', async () => {
    claimStripeEventMock.mockResolvedValue('stale')
    await handleWebhookEvent(
      makeEvent('customer.subscription.updated', { customer: 'cus_1', items: { data: [] }, status: 'active' }),
    )
    expect(updateSets).toHaveLength(0)
  })

  it('passes the event id/type/created and the extracted customer id to claimStripeEvent', async () => {
    await handleWebhookEvent(makeEvent('charge.refunded', { customer: 'cus_1', payment_intent: 'pi_1' }, 'evt_99'))
    expect(claimStripeEventMock).toHaveBeenCalledWith({
      id: 'evt_99',
      type: 'charge.refunded',
      created: new Date(1_700_000_000 * 1000),
      customerId: 'cus_1',
    })
  })
})

describe('handleWebhookEvent — S4 invoice.payment_failed null customer', () => {
  it('does not throw when the invoice has no customer, and does not update subscriptions', async () => {
    await expect(
      handleWebhookEvent(makeEvent('invoice.payment_failed', { customer: null })),
    ).resolves.toBeUndefined()
    expect(updateSets).toHaveLength(0)
    expect(loggerMock.warn).toHaveBeenCalled()
  })

  it('still updates subscription status to past_due when a customer is present', async () => {
    await handleWebhookEvent(makeEvent('invoice.payment_failed', { customer: 'cus_1' }))
    expect(updateSets).toContainEqual({ status: 'past_due' })
  })
})

describe('handleWebhookEvent — S5 getPlanFromPriceId', () => {
  it('logs an error instead of silently downgrading when the price id matches neither plan', async () => {
    await handleWebhookEvent(
      makeEvent('customer.subscription.updated', {
        customer: 'cus_1',
        items: { data: [{ price: { id: 'price_unknown' } }] },
        status: 'active',
      }),
    )
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_unknown' }),
      expect.stringContaining('defaulting to basic'),
    )
  })
})
