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

const createNotificationMock = vi.fn()
vi.mock('./notifications.service.js', () => ({
  createNotification: (...a: unknown[]) => createNotificationMock(...a),
}))

const { convertLeadToOrder, createLead } = await import('./leads.service.js')

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
  createNotificationMock.mockReset()
  createNotificationMock.mockResolvedValue(undefined)
})

// Every lead entry point — the public booking page, the Zapier webhook and
// manual entry — goes through createLead, so this is the one place the in-app
// notification has to be raised.
describe('createLead — in-app notification', () => {
  it('AC1 — raises a tenant-scoped notification pointing at the new lead', async () => {
    insertReturnQueue.push([{ id: 'lead-9', name: 'Rick Adams', phone: '9496329557' }])

    await createLead(TENANT_A, null, { name: 'Rick Adams', phone: '9496329557', source: 'booking_page' })

    expect(createNotificationMock).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      type: 'lead_new',
      title: 'New lead: Rick Adams',
      body: '(949) 632-9557 · Added from the booking page',
      relatedType: 'lead',
      relatedId: 'lead-9',
    })
  })

  it('AC1 — notifies for a Zapier webhook lead too', async () => {
    insertReturnQueue.push([{ id: 'lead-10', name: 'Dana', phone: null }])

    await createLead(TENANT_A, null, { name: 'Dana', source: 'zapier' })

    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'lead_new', body: 'Added via Zapier', relatedId: 'lead-10' }),
    )
  })

  it('leaves a phone that is not a US 10-digit number untouched', async () => {
    insertReturnQueue.push([{ id: 'lead-12', name: 'Dana', phone: '+44 20 7946 0958' }])

    await createLead(TENANT_A, null, { name: 'Dana', phone: '+44 20 7946 0958' })

    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: '+44 20 7946 0958 · Added manually' }),
    )
  })

  it('labels a manually entered lead and still returns it to the caller', async () => {
    insertReturnQueue.push([{ id: 'lead-11', name: 'Dana', phone: null }])

    const lead = await createLead(TENANT_A, USER_A, { name: 'Dana' })

    expect(lead).toMatchObject({ id: 'lead-11' })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Added manually' }),
    )
  })
})

function tenantSettingsRow(baseRates: Record<string, number>): Record<string, unknown> {
  return { settings: { baseRates, packingFee: 120 } }
}

describe('convertLeadToOrder', () => {
  it('AC5/AC6/AC8 — creates a client + order from the lead and marks it booked', async () => {
    selectQueue.push([lead()]) // getLead
    selectQueue.push([]) // client lookup — none found
    selectQueue.push([tenantSettingsRow({ '3br': 620 })]) // getTenantPricing
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

  // The $0-order bug this task fixes: a lead with a captured home size must
  // price the resulting order from the tenant's own rates, not leave it at
  // the schema default of 0.
  it('prices the order from tenant.baseRates for the lead\'s home size — not $0', async () => {
    selectQueue.push([lead({ home_size: 'studio' })]) // getLead
    selectQueue.push([{ id: 'client-existing', email: 'rick@example.com' }]) // client found
    selectQueue.push([tenantSettingsRow({ studio: 350, '3br': 620 })]) // getTenantPricing — non-default rate
    insertReturnQueue.push([{ id: 'order-priced' }])

    await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')

    expect(insertValues[0]).toMatchObject({ home_size: 'studio', base_price: 350, total_price: 350 })
  })

  it('reuses an existing client matched by phone (no new client insert)', async () => {
    selectQueue.push([lead()]) // getLead
    selectQueue.push([{ id: 'client-existing', email: 'rick@example.com' }]) // client found
    selectQueue.push([tenantSettingsRow({ '3br': 620 })]) // getTenantPricing
    insertReturnQueue.push([{ id: 'order-2' }]) // order insert (first insert call)

    const result = await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')
    expect(result).toEqual({ orderId: 'order-2' })
    // Only the order is inserted; client reused.
    expect(insertValues).toHaveLength(1)
    expect(insertValues[0]).toMatchObject({ client_id: 'client-existing' })
  })

  // Leads never capture packing intent (no `packing` column on leads at all),
  // so the packing fee must never be added at conversion.
  it('never adds a packing fee — leads have no packing intent to price it from', async () => {
    selectQueue.push([lead({ home_size: '2br' })])
    selectQueue.push([{ id: 'client-existing', email: 'rick@example.com' }])
    selectQueue.push([tenantSettingsRow({ '2br': 480 })])
    insertReturnQueue.push([{ id: 'order-nopacking' }])

    await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')

    expect(insertValues[0]).toMatchObject({ base_price: 480, total_price: 480 })
  })

  it('defaults missing move details when the lead is sparse, and leaves price deliberately at 0 — not a $0 order from a guessed home size', async () => {
    selectQueue.push([lead({ from_address: null, to_address: null, move_date: null, home_size: null })])
    selectQueue.push([{ id: 'client-1', email: 'rick@example.com' }])
    // No getTenantPricing select queued — a missing home size must never even
    // attempt to price the order, let alone from a guessed size.
    insertReturnQueue.push([{ id: 'order-3' }])

    await convertLeadToOrder(TENANT_A, USER_A, 'lead-1')
    const today = new Date().toISOString().split('T')[0]
    expect(insertValues[0]).toMatchObject({
      from_address: '', to_address: '', move_date: today, home_size: '2br',
      base_price: 0, total_price: 0,
    })
  })

  it('returns null when the lead is not found', async () => {
    selectQueue.push([]) // getLead → none
    const result = await convertLeadToOrder(TENANT_A, USER_A, 'missing')
    expect(result).toBeNull()
    expect(insertValues).toHaveLength(0)
  })
})
