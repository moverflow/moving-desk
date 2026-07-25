import { beforeEach, describe, expect, it, vi } from 'vitest'

// markInvoicePaidFromSession does one guarded UPDATE ... RETURNING, then a
// joined read for the email/notification payload. The fake queues the rows each
// step resolves to; an empty update return models a webhook replay.
const { updateReturnQueue, selectQueue, updateSets } = vi.hoisted(() => ({
  updateReturnQueue: [] as unknown[][],
  selectQueue: [] as unknown[][],
  updateSets: [] as unknown[],
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            innerJoin: () => ({
              where: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
            }),
          }),
        }),
      }),
    }),
    update: () => ({
      set: (v: unknown) => {
        updateSets.push(v)
        return {
          where: () => ({ returning: () => Promise.resolve(updateReturnQueue.shift() ?? []) }),
        }
      },
    }),
  },
}))

vi.mock('../lib/env.js', () => ({ env: { FRONTEND_URL: 'http://localhost:5173' } }))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../lib/stripe.js', () => ({ stripe: {} }))

const createNotificationMock = vi.fn()
vi.mock('./notifications.service.js', () => ({
  createNotification: (...a: unknown[]) => createNotificationMock(...a),
}))

const { markInvoicePaidFromSession } = await import('./invoices.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const INVOICE_ID = '77777777-7777-4777-8777-777777777777'

function emailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    number: 'INV-1089',
    moveDate: '2026-06-15',
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
    selectQueue.push([emailRow()])

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
})
