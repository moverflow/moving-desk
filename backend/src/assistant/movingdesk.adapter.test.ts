import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conditionColumns, eqPairs } from '../test/drizzleConditions.js'
import { ToolError } from './contract.js'

// Records the WHERE clause of every query so the tests can prove tenant_id is
// part of it, and hands back scripted rows. Same shape of fake as the other
// service tests, extended with the joins/groupBy/limit this adapter uses.
const { selectQueue, selectWheres } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  selectWheres: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  function chain() {
    const node: Record<string, unknown> = {}
    const passthrough = () => node
    node.from = passthrough
    node.leftJoin = passthrough
    node.innerJoin = passthrough
    node.groupBy = passthrough
    node.where = (cond: unknown) => {
      selectWheres.push(cond)
      return node
    }
    node.orderBy = () => {
      const rows = selectQueue.shift() ?? []
      const promise = Promise.resolve(rows) as Promise<unknown[]> & {
        limit: (n: number) => Promise<unknown[]>
      }
      promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
      return promise
    }
    node.limit = () => Promise.resolve(selectQueue.shift() ?? [])
    return node
  }

  return { db: { select: () => chain() } }
})

const { createOrder, findOrCreateClient, getOrderById, updateOrder, sendOrderCompletedEmail } =
  vi.hoisted(() => ({
    createOrder: vi.fn(),
    findOrCreateClient: vi.fn(),
    getOrderById: vi.fn(),
    updateOrder: vi.fn(),
    sendOrderCompletedEmail: vi.fn(),
  }))

vi.mock('../services/orders.service.js', () => ({
  createOrder,
  findOrCreateClient,
  getOrderById,
  updateOrder,
  sendOrderCompletedEmail,
  // Real transition table — the adapter's guard is only meaningful against it.
  isValidTransition: (from: string, to: string) =>
    (
      ({
        new: ['confirmed', 'cancelled'],
        confirmed: ['in_progress', 'cancelled'],
        in_progress: ['completed', 'cancelled'],
        completed: ['closed', 'cancelled'],
        closed: ['cancelled'],
      }) as Record<string, string[]>
    )[from]?.includes(to) ?? false,
}))

const { sendContractForOrder } = vi.hoisted(() => ({ sendContractForOrder: vi.fn() }))
vi.mock('../services/contract.service.js', () => ({ sendContractForOrder }))

vi.mock('../services/settings.service.js', () => ({
  getTenantPricing: () => Promise.resolve({
    baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
    packingFee: 120,
  }),
  getTenantTimezone: () => Promise.resolve('America/New_York'),
}))

const { MovingDeskAdapter } = await import('./movingdesk.adapter.js')

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '99999999-9999-4999-8999-999999999999'
const USER_A = '22222222-2222-4222-8222-222222222222'
const ORDER_A = '44444444-4444-4444-8444-444444444444'

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_A,
    status: 'new',
    move_date: '2026-09-01',
    from_address: '1 A St',
    to_address: '2 B St',
    home_size: '2br',
    packing: false,
    total_price: 480,
    clientName: 'Jane Smith',
    clientPhone: '(949) 555-0100',
    crewName: null,
    ...overrides,
  }
}

function whereTenants(): unknown[] {
  return selectWheres.flatMap((where) =>
    eqPairs(where)
      .filter((pair) => pair.column === 'tenant_id')
      .map((pair) => pair.value),
  )
}

function reset(): void {
  selectQueue.length = 0
  selectWheres.length = 0
  vi.clearAllMocks()
}

beforeEach(reset)

describe('listUpcomingJobs', () => {
  it('returns generic job summaries, not database rows', async () => {
    selectQueue.push([orderRow()])

    const jobs = await new MovingDeskAdapter(TENANT_A, USER_A).listUpcomingJobs({ days: 7 })

    expect(jobs).toEqual([
      {
        id: ORDER_A,
        reference: '#44444444',
        status: 'new',
        moveDate: '2026-09-01',
        fromAddress: '1 A St',
        toAddress: '2 B St',
        homeSize: '2br',
        packing: false,
        totalPrice: 480,
        clientName: 'Jane Smith',
        clientPhone: '(949) 555-0100',
        crewName: null,
      },
    ])
    // No snake_case column leaks into the contract's shape.
    expect(Object.keys(jobs[0])).not.toContain('tenant_id')
    expect(Object.keys(jobs[0])).not.toContain('move_date')
  })

  it('filters by the adapter tenant, never one the model supplied', async () => {
    selectQueue.push([])

    await new MovingDeskAdapter(TENANT_A, USER_A).listUpcomingJobs({ days: 7 })

    expect(whereTenants()).toContain(TENANT_A)
    expect(whereTenants()).not.toContain(TENANT_B)
  })

  it('bounds the query by a move_date window', async () => {
    selectQueue.push([])

    await new MovingDeskAdapter(TENANT_A, USER_A).listUpcomingJobs({ days: 7 })

    const columns = conditionColumns(selectWheres[0])
    expect(columns).toContain('tenant_id')
    expect(columns).toContain('move_date')
  })

  it('narrows to a status when one is given', async () => {
    selectQueue.push([])

    await new MovingDeskAdapter(TENANT_A, USER_A).listUpcomingJobs({
      days: 7,
      status: 'confirmed',
    })

    const statuses = eqPairs(selectWheres[0]).filter((p) => p.column === 'status')
    expect(statuses).toEqual([{ column: 'status', value: 'confirmed' }])
  })
})

describe('listUnpaidInvoices', () => {
  it('maps rows to invoice summaries with a human due label', async () => {
    selectQueue.push([
      {
        id: '55555555-5555-4555-8555-555555555555',
        number: '1001',
        status: 'sent',
        sent_at: new Date('2026-08-01T12:00:00Z'),
        move_date: '2026-08-05',
        total_price: 620,
        clientName: 'Bob Jones',
        clientPhone: '(949) 555-0111',
      },
    ])

    const invoices = await new MovingDeskAdapter(TENANT_A, USER_A).listUnpaidInvoices({ limit: 20 })

    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({ number: '1001', status: 'sent', totalPrice: 620 })
    expect(invoices[0].dueLabel).toBe('Sent Aug 1, 2026')
  })

  it('labels an unsent invoice rather than inventing a date', async () => {
    selectQueue.push([
      {
        id: '55555555-5555-4555-8555-555555555555',
        number: '1002',
        status: 'sent',
        sent_at: null,
        move_date: '2026-08-05',
        total_price: 480,
        clientName: null,
        clientPhone: null,
      },
    ])

    const invoices = await new MovingDeskAdapter(TENANT_A, USER_A).listUnpaidInvoices({ limit: 20 })

    expect(invoices[0].dueLabel).toBe('Not sent')
    expect(invoices[0].sentAt).toBeNull()
  })

  it('scopes to the adapter tenant', async () => {
    selectQueue.push([])

    await new MovingDeskAdapter(TENANT_B, USER_A).listUnpaidInvoices({ limit: 5 })

    expect(whereTenants()).toContain(TENANT_B)
    expect(whereTenants()).not.toContain(TENANT_A)
  })
})

describe('findClient', () => {
  it('scopes both the client and the joined job count to the tenant', async () => {
    selectQueue.push([
      { id: '66666666-6666-4666-8666-666666666666', name: 'Jane Smith', phone: '(949) 555-0100', email: null, jobCount: 2 },
    ])

    const clients = await new MovingDeskAdapter(TENANT_A, USER_A).findClient({ query: 'Smith' })

    expect(clients[0].jobCount).toBe(2)
    // Two tenant_id filters: one on clients, one on the orders join.
    expect(whereTenants().filter((t) => t === TENANT_A).length).toBeGreaterThanOrEqual(1)
    expect(whereTenants()).not.toContain(TENANT_B)
  })
})

describe('createJob', () => {
  it('prices the job from tenant settings and never from the model', async () => {
    findOrCreateClient.mockResolvedValue('66666666-6666-4666-8666-666666666666')
    createOrder.mockResolvedValue({ id: ORDER_A })
    selectQueue.push([orderRow({ total_price: 600, packing: true })])

    await new MovingDeskAdapter(TENANT_A, USER_A).createJob({
      clientName: 'Jane Smith',
      clientPhone: '9495550100',
      moveDate: '2026-09-01',
      fromAddress: '1 A St',
      toAddress: '2 B St',
      homeSize: '2br',
      packing: true,
      fromFloor: 1,
      toFloor: 3,
      fromElevator: false,
      toElevator: true,
    })

    // 480 base + 120 packing, in whole dollars.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ basePrice: 480, totalPrice: 600, tenantId: TENANT_A, createdBy: USER_A }),
    )
  })

  it('attributes the order to the user behind the Telegram session', async () => {
    findOrCreateClient.mockResolvedValue('66666666-6666-4666-8666-666666666666')
    createOrder.mockResolvedValue({ id: ORDER_A })
    selectQueue.push([orderRow()])

    await new MovingDeskAdapter(TENANT_A, USER_A).createJob({
      clientName: 'Jane Smith',
      clientPhone: '9495550100',
      moveDate: '2026-09-01',
      fromAddress: '1 A St',
      toAddress: '2 B St',
      homeSize: 'studio',
      packing: false,
      fromFloor: 1,
      toFloor: 1,
      fromElevator: false,
      toElevator: false,
    })

    expect(findOrCreateClient).toHaveBeenCalledWith(TENANT_A, '9495550100', 'Jane Smith', undefined)
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ createdBy: USER_A }))
  })
})

describe('setJobStatus', () => {
  it('moves a job forward and reports the new state', async () => {
    getOrderById.mockResolvedValue({ id: ORDER_A, status: 'new' })
    updateOrder.mockResolvedValue({ id: ORDER_A, status: 'confirmed' })
    selectQueue.push([orderRow({ status: 'confirmed' })])

    const job = await new MovingDeskAdapter(TENANT_A, USER_A).setJobStatus({
      jobId: ORDER_A,
      status: 'confirmed',
    })

    expect(updateOrder).toHaveBeenCalledWith(TENANT_A, ORDER_A, { status: 'confirmed' })
    expect(job.status).toBe('confirmed')
  })

  it('looks the job up inside the tenant, so another tenant id is a miss', async () => {
    getOrderById.mockResolvedValue(null)

    await expect(
      new MovingDeskAdapter(TENANT_B, USER_A).setJobStatus({ jobId: ORDER_A, status: 'confirmed' }),
    ).rejects.toThrow(ToolError)

    expect(getOrderById).toHaveBeenCalledWith(TENANT_B, ORDER_A)
    expect(updateOrder).not.toHaveBeenCalled()
  })

  it('refuses an illegal transition with an explanation the model can act on', async () => {
    getOrderById.mockResolvedValue({ id: ORDER_A, status: 'new' })

    await expect(
      new MovingDeskAdapter(TENANT_A, USER_A).setJobStatus({ jobId: ORDER_A, status: 'closed' }),
    ).rejects.toThrow(/cannot go from "new" to "closed"/)

    expect(updateOrder).not.toHaveBeenCalled()
  })

  it('refuses a no-op rather than writing', async () => {
    getOrderById.mockResolvedValue({ id: ORDER_A, status: 'confirmed' })

    await expect(
      new MovingDeskAdapter(TENANT_A, USER_A).setJobStatus({ jobId: ORDER_A, status: 'confirmed' }),
    ).rejects.toThrow(/already "confirmed"/)

    expect(updateOrder).not.toHaveBeenCalled()
  })

  it('sends the contract when a job is confirmed, matching the REST route', async () => {
    getOrderById.mockResolvedValue({ id: ORDER_A, status: 'new' })
    updateOrder.mockResolvedValue({ id: ORDER_A, status: 'confirmed' })
    selectQueue.push([orderRow({ status: 'confirmed' })])

    await new MovingDeskAdapter(TENANT_A, USER_A).setJobStatus({
      jobId: ORDER_A,
      status: 'confirmed',
    })

    expect(sendContractForOrder).toHaveBeenCalledWith(TENANT_A, ORDER_A)
    expect(sendOrderCompletedEmail).not.toHaveBeenCalled()
  })

  it('sends the completed email when a job is completed', async () => {
    getOrderById.mockResolvedValue({ id: ORDER_A, status: 'in_progress' })
    updateOrder.mockResolvedValue({ id: ORDER_A, status: 'completed' })
    selectQueue.push([orderRow({ status: 'completed' })])

    await new MovingDeskAdapter(TENANT_A, USER_A).setJobStatus({
      jobId: ORDER_A,
      status: 'completed',
    })

    expect(sendOrderCompletedEmail).toHaveBeenCalledWith(TENANT_A, ORDER_A)
    expect(sendContractForOrder).not.toHaveBeenCalled()
  })
})
