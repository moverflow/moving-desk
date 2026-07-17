import { beforeEach, describe, expect, it, vi } from 'vitest'

// sendOrderCompletedEmail issues a single joined read then resolves via .limit(1).
// The fake returns queued rows for that read and records the WHERE so we can
// assert the tenant filter (AC15).
const { selectQueue, whereConds } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  whereConds: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  const makeBuilder = () => {
    const builder = {
      from: () => builder,
      leftJoin: () => builder,
      innerJoin: () => builder,
      where: (cond: unknown) => {
        whereConds.push(cond)
        const rows = selectQueue.shift() ?? []
        const promise = Promise.resolve(rows) as Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> }
        promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
        return promise
      },
    }
    return builder
  }
  return { db: { select: () => makeBuilder() } }
})

vi.mock('../lib/env.js', () => ({
  env: { FRONTEND_URL: 'http://localhost:5173' },
}))

const sendMoveCompletedEmailMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendMoveCompletedEmail: (...args: unknown[]) => sendMoveCompletedEmailMock(...args),
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { sendOrderCompletedEmail } = await import('./orders.service.js')

function eqPairs(node: unknown, pairs: Array<{ column: string; value: unknown }> = []): Array<{ column: string; value: unknown }> {
  if (!node || typeof node !== 'object') return pairs
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return pairs
  const col = chunks.find(
    (c): c is { name: string } => typeof c === 'object' && c !== null && 'name' in c && 'columnType' in c,
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
const ORDER_ID = '33333333-3333-3333-3333-333333333333'

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    moveDate: '2026-07-18',
    clientEmail: 'jane@example.com',
    clientName: 'Jane',
    companyName: 'Acme Movers',
    companySettings: { phone: '(949) 555-0100' },
    shareToken: 'tok-abc',
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  whereConds.length = 0
  sendMoveCompletedEmailMock.mockReset()
  sendMoveCompletedEmailMock.mockResolvedValue(undefined)
})

describe('sendOrderCompletedEmail', () => {
  it('AC1/AC2 — sends the completed email with an invoice link when an invoice exists', async () => {
    selectQueue.push([row()])

    await sendOrderCompletedEmail(TENANT_A, ORDER_ID)

    expect(sendMoveCompletedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        clientName: 'Jane',
        companyName: 'Acme Movers',
        companyPhone: '(949) 555-0100',
        invoiceUrl: 'http://localhost:5173/i/tok-abc',
      }),
    )
  })

  it('AC5 — invoiceUrl is null when the order has no invoice', async () => {
    selectQueue.push([row({ shareToken: null })])

    await sendOrderCompletedEmail(TENANT_A, ORDER_ID)

    expect(sendMoveCompletedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceUrl: null }),
    )
  })

  it('AC4 — does not send when the client has no email', async () => {
    selectQueue.push([row({ clientEmail: null })])

    await sendOrderCompletedEmail(TENANT_A, ORDER_ID)

    expect(sendMoveCompletedEmailMock).not.toHaveBeenCalled()
  })

  it('AC4 — does not send when no matching order row is found', async () => {
    selectQueue.push([])

    await sendOrderCompletedEmail(TENANT_A, ORDER_ID)

    expect(sendMoveCompletedEmailMock).not.toHaveBeenCalled()
  })

  it('AC15 — scopes the lookup by order id and tenant id', async () => {
    selectQueue.push([row()])

    await sendOrderCompletedEmail(TENANT_A, ORDER_ID)

    const byColumn = Object.fromEntries(eqPairs(whereConds[0]).map((p) => [p.column, p.value]))
    expect(byColumn.id).toBe(ORDER_ID)
    expect(byColumn.tenant_id).toBe(TENANT_A)
  })

  it('never throws when the email send fails (best-effort)', async () => {
    selectQueue.push([row()])
    sendMoveCompletedEmailMock.mockRejectedValue(new Error('resend down'))

    await expect(sendOrderCompletedEmail(TENANT_A, ORDER_ID)).resolves.toBeUndefined()
  })
})
