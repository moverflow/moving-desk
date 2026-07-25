import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conditionColumns, eqPairs } from '../test/drizzleConditions.js'

// The service issues plain single-table reads and writes. The fake records every
// WHERE condition so the tests can prove tenant_id is always part of it, and
// lets a test make any one operation throw to check the swallow-and-log path.
const { selectQueue, selectWheres, insertValues, updateWheres, updateSets, failures } = vi.hoisted(
  () => ({
    selectQueue: [] as unknown[][],
    selectWheres: [] as unknown[],
    insertValues: [] as unknown[],
    updateWheres: [] as unknown[],
    updateSets: [] as unknown[],
    failures: { insert: false, select: false },
  }),
)

vi.mock('../db/index.js', () => {
  const selectChain = () => ({
    from: () => ({
      where: (cond: unknown) => {
        selectWheres.push(cond)
        if (failures.select) throw new Error('select failed')
        const rows = selectQueue.shift() ?? []
        const promise = Promise.resolve(rows) as Promise<unknown[]> & {
          limit: (n: number) => Promise<unknown[]> & { offset: (n: number) => Promise<unknown[]> }
          orderBy: (c: unknown) => {
            limit: (n: number) => { offset: (n: number) => Promise<unknown[]> }
          }
        }
        promise.limit = (n: number) => {
          const limited = Promise.resolve(rows.slice(0, n)) as Promise<unknown[]> & {
            offset: (o: number) => Promise<unknown[]>
          }
          limited.offset = (o: number) => Promise.resolve(rows.slice(o, o + n))
          return limited
        }
        promise.orderBy = () => ({
          limit: (n: number) => ({ offset: (o: number) => Promise.resolve(rows.slice(o, o + n)) }),
        })
        return promise
      },
    }),
  })

  return {
    db: {
      select: selectChain,
      insert: () => ({
        values: (v: unknown) => {
          if (failures.insert) return Promise.reject(new Error('insert failed'))
          insertValues.push(v)
          return Promise.resolve()
        },
      }),
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return {
            where: (cond: unknown) => {
              updateWheres.push(cond)
              return { returning: () => Promise.resolve(selectQueue.shift() ?? []) }
            },
          }
        },
      }),
    },
  }
})

const loggerErrorMock = vi.fn()
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: (...a: unknown[]) => loggerErrorMock(...a), warn: vi.fn() },
}))

const {
  createNotification,
  createNotificationOnce,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = await import('./notifications.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '99999999-9999-9999-9999-999999999999'
const NOTIFICATION_ID = '33333333-3333-3333-3333-333333333333'

beforeEach(() => {
  selectQueue.length = 0
  selectWheres.length = 0
  insertValues.length = 0
  updateWheres.length = 0
  updateSets.length = 0
  failures.insert = false
  failures.select = false
  loggerErrorMock.mockReset()
})

describe('createNotification', () => {
  it('AC1 — writes a tenant-scoped row with its related record', async () => {
    await createNotification({
      tenantId: TENANT_A,
      type: 'invoice_paid',
      title: 'Invoice INV-1089 paid',
      body: '$480 received',
      relatedType: 'invoice',
      relatedId: 'invoice-1',
    })

    expect(insertValues[0]).toMatchObject({
      tenant_id: TENANT_A,
      type: 'invoice_paid',
      title: 'Invoice INV-1089 paid',
      body: '$480 received',
      related_type: 'invoice',
      related_id: 'invoice-1',
    })
  })

  it('defaults the optional fields to null rather than undefined', async () => {
    await createNotification({ tenantId: TENANT_A, type: 'lead_new', title: 'New lead: Rick' })
    expect(insertValues[0]).toMatchObject({ body: null, related_type: null, related_id: null })
  })

  // The whole point of the trigger-point wiring: a booking, a signature or a
  // Stripe webhook must never fail because the notification insert did.
  it('swallows and logs a database failure instead of throwing', async () => {
    failures.insert = true
    await expect(
      createNotification({ tenantId: TENANT_A, type: 'lead_new', title: 'New lead: Rick' }),
    ).resolves.toBeUndefined()
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})

describe('createNotificationOnce', () => {
  it('inserts when no notification exists for that related record', async () => {
    selectQueue.push([])
    await createNotificationOnce({
      tenantId: TENANT_A,
      type: 'move_reminder',
      title: 'Move tomorrow: Jane',
      relatedId: 'order-1',
    })
    expect(insertValues).toHaveLength(1)
  })

  it('skips the insert when one already exists', async () => {
    selectQueue.push([{ id: NOTIFICATION_ID }])
    await createNotificationOnce({
      tenantId: TENANT_A,
      type: 'move_reminder',
      title: 'Move tomorrow: Jane',
      relatedId: 'order-1',
    })
    expect(insertValues).toHaveLength(0)
  })

  it('scopes the dedupe lookup to the tenant, type and related record', async () => {
    selectQueue.push([])
    await createNotificationOnce({
      tenantId: TENANT_A,
      type: 'move_reminder',
      title: 'Move tomorrow: Jane',
      relatedId: 'order-1',
    })

    const byColumn = Object.fromEntries(eqPairs(selectWheres[0]).map((p) => [p.column, p.value]))
    expect(byColumn.tenant_id).toBe(TENANT_A)
    expect(byColumn.type).toBe('move_reminder')
    expect(byColumn.related_id).toBe('order-1')
  })

  it('swallows a failing dedupe lookup without inserting', async () => {
    failures.select = true
    await expect(
      createNotificationOnce({
        tenantId: TENANT_A,
        type: 'move_reminder',
        title: 'Move tomorrow: Jane',
        relatedId: 'order-1',
      }),
    ).resolves.toBeUndefined()
    expect(insertValues).toHaveLength(0)
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})

describe('listNotifications', () => {
  it('AC2 — filters by tenant_id and counts unread for that tenant only', async () => {
    selectQueue.push([{ id: NOTIFICATION_ID }]) // page of rows
    selectQueue.push([{ value: 3 }]) // unread count

    const result = await listNotifications(TENANT_A, { limit: 20, offset: 0 })

    expect(result.unreadCount).toBe(3)
    expect(eqPairs(selectWheres[0])).toEqual([{ column: 'tenant_id', value: TENANT_A }])

    const unreadPairs = Object.fromEntries(eqPairs(selectWheres[1]).map((p) => [p.column, p.value]))
    expect(unreadPairs.tenant_id).toBe(TENANT_A)
    expect(conditionColumns(selectWheres[1])).toContain('read_at')
  })

  it('reports zero unread when the count query returns nothing', async () => {
    selectQueue.push([])
    selectQueue.push([])
    const result = await listNotifications(TENANT_A, { limit: 20, offset: 0 })
    expect(result).toEqual({ notifications: [], unreadCount: 0 })
  })
})

describe('markNotificationRead', () => {
  it('AC3 — sets read_at filtered by both id and tenant_id', async () => {
    selectQueue.push([{ id: NOTIFICATION_ID }]) // update ... returning

    const result = await markNotificationRead(TENANT_A, NOTIFICATION_ID)

    expect(result).toBe(true)
    expect(updateSets[0]).toMatchObject({ read_at: expect.any(Date) })
    const byColumn = Object.fromEntries(eqPairs(updateWheres[0]).map((p) => [p.column, p.value]))
    expect(byColumn.id).toBe(NOTIFICATION_ID)
    expect(byColumn.tenant_id).toBe(TENANT_A)
  })

  // Tenant isolation: the row exists, but not for this tenant, so both the
  // update and the follow-up existence check come back empty.
  it('AC2 — reports not-found for a notification belonging to another tenant', async () => {
    selectQueue.push([]) // update matched nothing
    selectQueue.push([]) // existence check for this tenant — nothing

    const result = await markNotificationRead(TENANT_B, NOTIFICATION_ID)

    expect(result).toBe(false)
    const byColumn = Object.fromEntries(eqPairs(selectWheres[0]).map((p) => [p.column, p.value]))
    expect(byColumn.tenant_id).toBe(TENANT_B)
  })

  it('treats an already-read notification as a success', async () => {
    selectQueue.push([]) // update matched nothing (read_at already set)
    selectQueue.push([{ id: NOTIFICATION_ID }]) // but the row is this tenant's

    expect(await markNotificationRead(TENANT_A, NOTIFICATION_ID)).toBe(true)
  })
})

describe('markAllNotificationsRead', () => {
  it('AC3 — clears only this tenant\'s unread rows and reports how many', async () => {
    selectQueue.push([{ id: 'n-1' }, { id: 'n-2' }])

    const updated = await markAllNotificationsRead(TENANT_A)

    expect(updated).toBe(2)
    expect(eqPairs(updateWheres[0])).toEqual([{ column: 'tenant_id', value: TENANT_A }])
    expect(conditionColumns(updateWheres[0])).toContain('read_at')
  })
})
