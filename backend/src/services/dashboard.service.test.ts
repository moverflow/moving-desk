import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'

// The dashboard aggregations (COUNT/SUM/FILTER, date_trunc grouping, tenant-scoped
// joins) are too SQL-heavy to fake faithfully in memory without re-implementing the
// same logic under test — so, unlike clients.service.test.ts, this runs against a
// real local Postgres instance. If one isn't reachable the suite skips instead of
// failing CI on environments without a local DB.
const TEST_DATABASE_URL =
  process.env.DASHBOARD_TEST_DATABASE_URL ?? 'postgresql://localhost:5432/movingdesk_test'

vi.mock('../db/index.js', async () => {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schemaModule = await import('../db/schema.js')
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  return { db: drizzle(pool, { schema: schemaModule }) }
})

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { db } = await import('../db/index.js')
const { tenants, users, crews, orders } = await import('../db/schema.js')
const { getSummary, getOrdersByStatus, getOrdersByWeek, getTopCrews } = await import('./dashboard.service.js')

let dbAvailable = true
try {
  await db.execute(sql`select 1`)
} catch {
  dbAvailable = false
  // eslint-disable-next-line no-console
  console.warn(
    `[dashboard.service.test.ts] skipping — no Postgres reachable at ${TEST_DATABASE_URL}. ` +
      'Run migrations against a local test DB to enable these tests.'
  )
}

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '22222222-2222-2222-2222-222222222222'

async function seedTenant(id: string, name: string): Promise<{ tenantId: string; userId: string }> {
  await db.insert(tenants).values({ id, name, slug: `${name.toLowerCase()}-${id.slice(0, 8)}` })
  const [user] = await db
    .insert(users)
    .values({
      tenant_id: id,
      email: `owner-${id}@example.com`,
      password_hash: 'hash',
      role: 'owner',
      name: 'Owner',
    })
    .returning()
  return { tenantId: id, userId: user.id }
}

async function seedCrew(tenantId: string, name: string, truckLabel: string): Promise<string> {
  const [crew] = await db.insert(crews).values({ tenant_id: tenantId, name, truck_label: truckLabel }).returning()
  return crew.id
}

interface SeedOrderInput {
  tenantId: string
  userId: string
  crewId?: string | null
  status: 'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'
  moveDate: string
  totalPrice: number
  createdAt?: Date
}

async function seedOrder(input: SeedOrderInput): Promise<void> {
  await db.insert(orders).values({
    tenant_id: input.tenantId,
    created_by: input.userId,
    crew_id: input.crewId ?? null,
    status: input.status,
    move_date: input.moveDate,
    from_address: '1 A St',
    to_address: '2 B St',
    home_size: '2br',
    base_price: input.totalPrice,
    total_price: input.totalPrice,
    ...(input.createdAt ? { created_at: input.createdAt } : {}),
  })
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

describe.skipIf(!dbAvailable)('dashboard.service (real Postgres)', () => {
  beforeEach(async () => {
    await db.delete(orders)
    await db.delete(crews)
    await db.delete(users)
    await db.delete(tenants)
  })

  describe('getSummary / getOrdersByStatus — tenant isolation', () => {
    it('never includes another tenant totals in the summary or status breakdown', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      const b = await seedTenant(TENANT_B, 'TenantB')

      await seedOrder({ tenantId: a.tenantId, userId: a.userId, status: 'completed', moveDate: daysAgo(2), totalPrice: 500 })
      await seedOrder({ tenantId: a.tenantId, userId: a.userId, status: 'cancelled', moveDate: daysAgo(3), totalPrice: 100 })
      await seedOrder({ tenantId: b.tenantId, userId: b.userId, status: 'completed', moveDate: daysAgo(2), totalPrice: 999999 })

      const summaryA = await getSummary(TENANT_A, 'month')
      expect(summaryA.totalOrders).toBe(2)
      expect(summaryA.completedOrders).toBe(1)
      expect(summaryA.cancelledOrders).toBe(1)
      expect(summaryA.totalRevenue).toBe(500)
      expect(summaryA.avgOrderValue).toBe(500)

      const statusA = await getOrdersByStatus(TENANT_A, 'month')
      expect(statusA.every((row) => row.revenue < 999999)).toBe(true)
      const totalStatusRevenue = statusA.reduce((sum, row) => sum + row.revenue, 0)
      expect(totalStatusRevenue).toBe(600)
    })

    it('returns avgOrderValue 0, not NaN or Infinity, when there are zero completed orders', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      await seedOrder({ tenantId: a.tenantId, userId: a.userId, status: 'new', moveDate: daysAgo(1), totalPrice: 300 })

      const summary = await getSummary(TENANT_A, 'month')
      expect(summary.completedOrders).toBe(0)
      expect(summary.totalRevenue).toBe(0)
      expect(summary.avgOrderValue).toBe(0)
      expect(Number.isFinite(summary.avgOrderValue)).toBe(true)
    })
  })

  describe('getOrdersByWeek — tenant isolation', () => {
    it('never leaks another tenant revenue or order counts into the weekly series', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      const b = await seedTenant(TENANT_B, 'TenantB')

      const thisWeek = daysAgo(1)
      await seedOrder({ tenantId: a.tenantId, userId: a.userId, status: 'completed', moveDate: thisWeek, totalPrice: 400 })
      await seedOrder({ tenantId: b.tenantId, userId: b.userId, status: 'completed', moveDate: thisWeek, totalPrice: 700000 })

      const weekA = await getOrdersByWeek(TENANT_A)
      const totalRevenueA = weekA.reduce((sum, row) => sum + row.revenue, 0)
      const totalOrdersA = weekA.reduce((sum, row) => sum + row.orders, 0)
      expect(totalRevenueA).toBe(400)
      expect(totalOrdersA).toBe(1)
    })
  })

  describe('getTopCrews — tenant isolation', () => {
    it('never includes another tenant crew or revenue, even with identically named crews', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      const b = await seedTenant(TENANT_B, 'TenantB')
      const crewA = await seedCrew(a.tenantId, 'Alpha Crew', 'Truck 1')
      const crewB = await seedCrew(b.tenantId, 'Alpha Crew', 'Truck 9')

      await seedOrder({ tenantId: a.tenantId, userId: a.userId, crewId: crewA, status: 'completed', moveDate: daysAgo(2), totalPrice: 500 })
      await seedOrder({ tenantId: b.tenantId, userId: b.userId, crewId: crewB, status: 'completed', moveDate: daysAgo(2), totalPrice: 999999 })

      const topA = await getTopCrews(TENANT_A, 'month')
      expect(topA).toHaveLength(1)
      expect(topA[0].crewName).toBe('Alpha Crew')
      expect(topA[0].truckLabel).toBe('Truck 1')
      expect(topA[0].revenue).toBe(500)
      expect(topA[0].ordersCount).toBe(1)
    })

    it('excludes an order whose crew_id points at another tenant crew row (defense-in-depth join scoping)', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      const b = await seedTenant(TENANT_B, 'TenantB')
      const crewB = await seedCrew(b.tenantId, 'Bravo Crew', 'Truck 9')

      // Simulates a data-integrity edge case (e.g. a future bug in order/crew
      // assignment) where an order's tenant_id is A but crew_id references a
      // crew row owned by tenant B. The join must not blend tenant B's crew
      // into tenant A's analytics.
      await seedOrder({ tenantId: a.tenantId, userId: a.userId, crewId: crewB, status: 'completed', moveDate: daysAgo(2), totalPrice: 500 })

      const topA = await getTopCrews(TENANT_A, 'month')
      expect(topA).toHaveLength(0)
    })

    it('excludes orders with a null crew_id from the top-crews list', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')
      const crewA = await seedCrew(a.tenantId, 'Alpha Crew', 'Truck 1')

      await seedOrder({ tenantId: a.tenantId, userId: a.userId, crewId: crewA, status: 'completed', moveDate: daysAgo(2), totalPrice: 500 })
      await seedOrder({ tenantId: a.tenantId, userId: a.userId, crewId: null, status: 'completed', moveDate: daysAgo(2), totalPrice: 800 })

      const topA = await getTopCrews(TENANT_A, 'month')
      expect(topA).toHaveLength(1)
      expect(topA[0].revenue).toBe(500)
      expect(topA[0].ordersCount).toBe(1)
    })

    it('caps the result at 5 crews even when more than 5 have revenue in the period', async () => {
      const a = await seedTenant(TENANT_A, 'TenantA')

      for (let i = 0; i < 7; i += 1) {
        const crewId = await seedCrew(a.tenantId, `Crew ${i}`, `Truck ${i}`)
        await seedOrder({
          tenantId: a.tenantId,
          userId: a.userId,
          crewId,
          status: 'completed',
          moveDate: daysAgo(2),
          totalPrice: 100 + i * 10,
        })
      }

      const topA = await getTopCrews(TENANT_A, 'month')
      expect(topA).toHaveLength(5)
      expect(topA[0].revenue).toBe(160)
      expect(topA[4].revenue).toBe(120)
    })
  })
})
