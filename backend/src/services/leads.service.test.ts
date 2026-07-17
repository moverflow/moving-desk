import { beforeEach, describe, expect, it, vi } from 'vitest'

// convertLeadToOrder issues: getLead (select), client lookup (select), maybe a
// client insert, an order insert, then a lead update. The fake queues rows for
// each select/insert and records insert values + update sets so we can assert
// the order is pre-filled and the lead is marked booked.
const { selectQueue, insertReturnQueue, insertValues, updateSets } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertReturnQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValues.push(v)
        return { returning: () => Promise.resolve(insertReturnQueue.shift() ?? []) }
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        updateSets.push(v)
        return { where: () => Promise.resolve() }
      },
    }),
  },
}))

const { convertLeadToOrder } = await import('./leads.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'

function lead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'lead-1',
    tenant_id: TENANT_A,
    name: 'Rick Adams',
    phone: '9496329557',
    email: 'rick@example.com',
    from_address: 'Irvine, CA',
    to_address: 'Anaheim, CA',
    move_date: '2026-07-20',
    home_size: '3br',
    notes: 'Piano',
    status: 'new',
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  insertReturnQueue.length = 0
  insertValues.length = 0
  updateSets.length = 0
})

describe('convertLeadToOrder', () => {
  it('AC5/AC6/AC8 — creates a client + order from the lead and marks it booked', async () => {
    selectQueue.push([lead()]) // getLead
    selectQueue.push([]) // client lookup — none found
    insertReturnQueue.push([{ id: 'client-1' }]) // client insert
    insertReturnQueue.push([{ id: 'order-1' }]) // order insert

    const result = await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')
    expect(result).toEqual({ orderId: 'order-1' })

    // AC8 — client auto-created from lead phone/email
    expect(insertValues[0]).toMatchObject({ tenant_id: TENANT_A, name: 'Rick Adams', phone: '9496329557', email: 'rick@example.com' })

    // AC5 — order pre-filled from lead data
    expect(insertValues[1]).toMatchObject({
      tenant_id: TENANT_A,
      client_id: 'client-1',
      created_by: USER_A,
      status: 'new',
      from_address: 'Irvine, CA',
      to_address: 'Anaheim, CA',
      move_date: '2026-07-20',
      home_size: '3br',
    })

    // AC6 — lead becomes booked with a back-link to the order
    expect(updateSets[0]).toMatchObject({ status: 'booked', converted_order_id: 'order-1' })
  })

  it('reuses an existing client matched by phone (no new client insert)', async () => {
    selectQueue.push([lead()]) // getLead
    selectQueue.push([{ id: 'client-existing', email: 'rick@example.com' }]) // client found
    insertReturnQueue.push([{ id: 'order-2' }]) // order insert (first insert call)

    const result = await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')
    expect(result).toEqual({ orderId: 'order-2' })
    // Only the order is inserted; client reused.
    expect(insertValues).toHaveLength(1)
    expect(insertValues[0]).toMatchObject({ client_id: 'client-existing' })
  })

  it('defaults missing move details when the lead is sparse', async () => {
    selectQueue.push([lead({ from_address: null, to_address: null, move_date: null, home_size: null })])
    selectQueue.push([{ id: 'client-1', email: 'rick@example.com' }])
    insertReturnQueue.push([{ id: 'order-3' }])

    await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')
    const today = new Date().toISOString().split('T')[0]
    expect(insertValues[0]).toMatchObject({ from_address: '', to_address: '', move_date: today, home_size: '2br' })
  })

  it('returns null when the lead is not found', async () => {
    selectQueue.push([]) // getLead → none
    const result = await convertLeadToOrder(TENANT_A, USER_A, 'missing')
    expect(result).toBeNull()
    expect(insertValues).toHaveLength(0)
  })
})
