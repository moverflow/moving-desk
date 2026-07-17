import { beforeEach, describe, expect, it, vi } from 'vitest'

// The reminder job issues a fixed sequence of reads: one orders query, then per
// order a clients query and a tenants query. Tests queue the rows each read
// should resolve to, and the fake records every WHERE condition and UPDATE so we
// can assert both the filter (AC9/AC10/AC13) and the reminder_sent write (AC11).
const { selectQueue, whereConds, updateCalls } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  whereConds: [] as unknown[],
  updateCalls: [] as Array<{ values: unknown }>,
}))

vi.mock('../db/index.js', () => {
  const resolveWhere = (cond: unknown) => {
    whereConds.push(cond)
    const rows = selectQueue.shift() ?? []
    const promise = Promise.resolve(rows) as Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> }
    promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
    return promise
  }
  return {
    db: {
      select: () => ({ from: () => ({ where: resolveWhere }) }),
      update: () => ({
        set: (values: unknown) => ({
          where: () => {
            updateCalls.push({ values })
            return Promise.resolve()
          },
        }),
      }),
    },
  }
})

vi.mock('../lib/env.js', () => ({
  env: { FRONTEND_URL: 'http://localhost:5173' },
}))

const sendMoveReminderEmailMock = vi.fn()
const sendLeadReminderEmailMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendMoveReminderEmail: (...args: unknown[]) => sendMoveReminderEmailMock(...args),
  sendLeadReminderEmail: (...args: unknown[]) => sendLeadReminderEmailMock(...args),
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { sendDailyReminders, sendUncontactedLeadReminders } = await import('./reminder.js')

function eqPairs(node: unknown, pairs: Array<{ column: string; value: unknown }> = []): Array<{ column: string; value: unknown }> {
  if (!node || typeof node !== 'object') return pairs
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return pairs
  const col = chunks.find(
    (c): c is { name: string } =>
      typeof c === 'object' && c !== null && 'name' in c && 'columnType' in c,
  )
  const param = chunks.find(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      'value' in c &&
      !('columnType' in c) &&
      !Array.isArray((c as { value: unknown }).value),
  ) as { value: unknown } | undefined
  if (col && param) {
    pairs.push({ column: col.name, value: param.value })
    return pairs
  }
  for (const chunk of chunks) eqPairs(chunk, pairs)
  return pairs
}

const TENANT_A = '11111111-1111-1111-1111-111111111111'

function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: 'order-1',
    tenantId: TENANT_A,
    moveDate: '2026-07-18',
    fromAddress: '1 Main St',
    toAddress: '2 Oak Ave',
    clientId: 'client-1',
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  whereConds.length = 0
  updateCalls.length = 0
  sendMoveReminderEmailMock.mockReset()
  sendMoveReminderEmailMock.mockResolvedValue(undefined)
  sendLeadReminderEmailMock.mockReset()
  sendLeadReminderEmailMock.mockResolvedValue(undefined)
})

describe('sendDailyReminders', () => {
  it('AC9/AC11 — sends a reminder for a matching order and marks reminder_sent', async () => {
    selectQueue.push(
      [orderRow()],
      [{ name: 'Jane', email: 'jane@example.com' }],
      [{ name: 'Acme Movers', settings: { phone: '(949) 555-0100' } }],
    )

    await sendDailyReminders()

    expect(sendMoveReminderEmailMock).toHaveBeenCalledTimes(1)
    expect(sendMoveReminderEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        clientName: 'Jane',
        companyName: 'Acme Movers',
        companyPhone: '(949) 555-0100',
        fromAddress: '1 Main St',
        toAddress: '2 Oak Ave',
      }),
    )
    expect(updateCalls).toEqual([{ values: { reminder_sent: true } }])
  })

  it('AC9/AC10/AC13 — orders query filters by tomorrow, confirmed, and not-yet-reminded', async () => {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const expected = tomorrow.toISOString().split('T')[0]

    selectQueue.push([])
    await sendDailyReminders()

    const pairs = eqPairs(whereConds[0])
    const byColumn = Object.fromEntries(pairs.map((p) => [p.column, p.value]))
    expect(byColumn.move_date).toBe(expected)
    expect(byColumn.status).toBe('confirmed')
    expect(byColumn.reminder_sent).toBe(false)
  })

  it('AC12 — one failing email does not stop the rest of the run', async () => {
    selectQueue.push(
      [orderRow({ orderId: 'order-1', clientId: 'client-1' }), orderRow({ orderId: 'order-2', clientId: 'client-2' })],
      [{ name: 'First', email: 'first@example.com' }],
      [{ name: 'Acme', settings: {} }],
      [{ name: 'Second', email: 'second@example.com' }],
      [{ name: 'Acme', settings: {} }],
    )
    sendMoveReminderEmailMock.mockRejectedValueOnce(new Error('send failed'))

    await sendDailyReminders()

    expect(sendMoveReminderEmailMock).toHaveBeenCalledTimes(2)
    // Only the second (successful) order is marked reminded; the failed one is left
    // so the next run retries it.
    expect(updateCalls).toEqual([{ values: { reminder_sent: true } }])
  })

  it('AC4-equivalent — skips an order whose client has no email and does not mark it', async () => {
    selectQueue.push([orderRow()], [{ name: 'Jane', email: null }])

    await sendDailyReminders()

    expect(sendMoveReminderEmailMock).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })

  it('skips an order with no client at all', async () => {
    selectQueue.push([orderRow({ clientId: null })])

    await sendDailyReminders()

    expect(sendMoveReminderEmailMock).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })
})

function staleLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    leadId: 'lead-1',
    tenantId: TENANT_A,
    name: 'Rick Adams',
    phone: '(949) 632-9557',
    source: 'booking_page',
    createdAt: new Date('2026-07-01T12:00:00Z'),
    ...overrides,
  }
}

describe('sendUncontactedLeadReminders', () => {
  it('AC13/AC14 — emails the owner about a stale new lead and marks it reminded', async () => {
    selectQueue.push([staleLead()]) // stale leads query
    selectQueue.push([{ email: 'owner@example.com', name: 'Owner' }]) // owner lookup

    await sendUncontactedLeadReminders()

    expect(sendLeadReminderEmailMock).toHaveBeenCalledTimes(1)
    expect(sendLeadReminderEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        ownerName: 'Owner',
        leadName: 'Rick Adams',
        leadsUrl: 'http://localhost:5173/orders?tab=leads', // AC15
      }),
    )
    expect(updateCalls).toEqual([{ values: { reminder_sent: true } }])
  })

  it('AC13 — the stale-lead query filters by status=new and reminder_sent=false', async () => {
    selectQueue.push([])
    await sendUncontactedLeadReminders()

    const byColumn = Object.fromEntries(eqPairs(whereConds[0]).map((p) => [p.column, p.value]))
    expect(byColumn.status).toBe('new')
    expect(byColumn.reminder_sent).toBe(false)
  })

  it('skips a lead whose tenant has no owner email and does not mark it', async () => {
    selectQueue.push([staleLead()])
    selectQueue.push([]) // no owner

    await sendUncontactedLeadReminders()

    expect(sendLeadReminderEmailMock).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })
})
