import { beforeEach, describe, expect, it, vi } from 'vitest'

// markInvoicePaidFromSession does one guarded UPDATE ... RETURNING, then a
// joined read for the email/notification payload; markInvoiceRefunded/Disputed do a
// plain (unjoined) select-by-payment-intent then an update. Rather than one fixed
// chain shape per query, `select()` returns a generic chain where every method
// (from/innerJoin/leftJoin/where/limit) just returns itself and resolving it (by
// await, or `.limit()`) shifts the next row set off the shared queue — so however
// many joins a given query has, each top-level select still pulls exactly one
// pre-queued result, in call order.
const { updateReturnQueue, selectQueue, updateSets } = vi.hoisted(() => ({
  updateReturnQueue: [] as unknown[][],
  selectQueue: [] as unknown[][],
  updateSets: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  function resolve() {
    return Promise.resolve(selectQueue.shift() ?? [])
  }
  function selectChain(): unknown {
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      limit: () => resolve(),
      then: (onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    }
    return chain
  }
  return {
    db: {
      select: () => selectChain(),
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return {
            where: () => ({ returning: () => Promise.resolve(updateReturnQueue.shift() ?? []) }),
          }
        },
      }),
    },
  }
})

vi.mock('../lib/env.js', () => ({ env: { FRONTEND_URL: 'http://localhost:5173' } }))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../lib/stripe.js', () => ({ stripe: {} }))

const createNotificationMock = vi.fn()
vi.mock('./notifications.service.js', () => ({
  createNotification: (...a: unknown[]) => createNotificationMock(...a),
}))

const { markInvoicePaidFromSession, markInvoiceRefunded, markInvoiceDisputed, clearInvoiceCheckoutSession } =
  await import('./invoices.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const INVOICE_ID = '77777777-7777-4777-8777-777777777777'

function emailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    number: 'INV-1089',
    moveDate: '2026-06-15',
    totalPrice: 480,
    clientEmail: 'rick@example.com',
    clientName: 'Rick Adams',
    companyName: 'Best Movers',
    ...overrides,
  }
}

beforeEach(() => {
  updateReturnQueue.length = 0
  selectQueue.length = 0
  updateSets.length = 0
  createNotificationMock.mockReset()
  createNotificationMock.mockResolvedValue(undefined)
})

describe('markInvoicePaidFromSession — in-app notification', () => {
  it('AC1 — raises a tenant-scoped notification pointing at the paid invoice', async () => {
    updateReturnQueue.push([{ id: INVOICE_ID }])
    selectQueue.push([emailRow()])

    const result = await markInvoicePaidFromSession({
      invoiceId: INVOICE_ID,
      paymentIntentId: 'pi_123',
      amountTotal: 48000,
    })

    expect(result).toMatchObject({ number: 'INV-1089', amount: 480 })
    expect(createNotificationMock).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      type: 'invoice_paid',
      title: 'Invoice INV-1089 paid',
      body: '$480 received from Rick Adams',
      relatedType: 'invoice',
      relatedId: INVOICE_ID,
    })
  })

  // The email only goes out when the client has an address; the in-app
  // notification must not inherit that condition.
  it('AC1 — notifies even when the client has no email address', async () => {
    updateReturnQueue.push([{ id: INVOICE_ID }])
    selectQueue.push([emailRow({ clientEmail: null, clientName: null })])

    await markInvoicePaidFromSession({
      invoiceId: INVOICE_ID,
      paymentIntentId: 'pi_123',
      amountTotal: 48000,
    })

    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: '$480 received' }),
    )
  })

  it('does not notify on a webhook replay of an already-paid invoice', async () => {
    updateReturnQueue.push([]) // status guard matched nothing

    const result = await markInvoicePaidFromSession({
      invoiceId: INVOICE_ID,
      paymentIntentId: 'pi_123',
      amountTotal: 48000,
    })

    expect(result).toBeNull()
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('records the paid amount in whole dollars, not Stripe cents', async () => {
    updateReturnQueue.push([{ id: INVOICE_ID }])
    selectQueue.push([emailRow({ totalPrice: 1250 })])

    await markInvoicePaidFromSession({
      invoiceId: INVOICE_ID,
      paymentIntentId: null,
      amountTotal: 125000,
    })

    expect(updateSets[0]).toMatchObject({ status: 'paid', paid_amount: 1250 })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: '$1,250 received from Rick Adams' }),
    )
  })

  it('S1 — flags (logs + still records) a mismatch between amount_total and total_price', async () => {
    updateReturnQueue.push([{ id: INVOICE_ID }])
    selectQueue.push([emailRow({ totalPrice: 600 })]) // order total_price is $600

    const result = await markInvoicePaidFromSession({
      invoiceId: INVOICE_ID,
      paymentIntentId: 'pi_123',
      amountTotal: 48000, // Stripe only charged $480
    })

    expect(result).toMatchObject({ amount: 480 })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('amount mismatch') }),
    )
  })
})

describe('markInvoiceRefunded / markInvoiceDisputed', () => {
  it('S1 — marks the invoice refunded and notifies, found by payment intent', async () => {
    selectQueue.push([{ id: INVOICE_ID, tenantId: TENANT_A, number: 'INV-1089' }])

    await markInvoiceRefunded('pi_123')

    expect(updateSets[0]).toMatchObject({ status: 'refunded' })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice_refunded', tenantId: TENANT_A, relatedId: INVOICE_ID }),
    )
  })

  it('S1 — no-ops when no invoice matches the payment intent', async () => {
    selectQueue.push([])

    await markInvoiceRefunded('pi_unknown')

    expect(updateSets).toHaveLength(0)
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('S1 — marks the invoice disputed and notifies', async () => {
    selectQueue.push([{ id: INVOICE_ID, tenantId: TENANT_A, number: 'INV-1089' }])

    await markInvoiceDisputed('pi_123')

    expect(updateSets[0]).toMatchObject({ status: 'disputed' })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice_disputed', tenantId: TENANT_A, relatedId: INVOICE_ID }),
    )
  })
})

describe('clearInvoiceCheckoutSession', () => {
  it('S1 — clears the stale session id without touching status', async () => {
    await clearInvoiceCheckoutSession(INVOICE_ID)
    expect(updateSets[0]).toEqual({ stripe_checkout_session_id: null })
  })
})
