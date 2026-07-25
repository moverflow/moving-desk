import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'

// S6: two concurrent generateInvoice() calls for the same tenant used to be able to
// read the same count(*) and insert the same number — a race that can't be proven
// fixed against an in-memory fake (the whole point is that the atomic counter
// upsert actually serializes concurrent writers), so this fires genuinely
// concurrent requests against a real local Postgres instance. Skip-if-unreachable,
// same convention as dashboard.service.test.ts.
const TEST_DATABASE_URL =
  process.env.INVOICES_TEST_DATABASE_URL ?? 'postgresql://localhost:5432/movingdesk_test'

vi.mock('../db/index.js', async () => {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schemaModule = await import('../db/schema.js')
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  return { db: drizzle(pool, { schema: schemaModule }) }
})

vi.mock('../lib/env.js', () => ({ env: { FRONTEND_URL: 'http://localhost:5173' } }))
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock('../lib/stripe.js', () => ({ stripe: {} }))
vi.mock('./notifications.service.js', () => ({ createNotification: vi.fn() }))

const { db } = await import('../db/index.js')
const { tenants, users, orders, invoices, invoiceCounters } = await import('../db/schema.js')
const { generateInvoice } = await import('./invoices.service.js')

let dbAvailable = true
try {
  await db.execute(sql`select 1`)
} catch {
  dbAvailable = false
  // eslint-disable-next-line no-console
  console.warn(
    `[invoices.concurrency.test.ts] skipping — no Postgres reachable at ${TEST_DATABASE_URL}. ` +
      'Run migrations against a local test DB to enable these tests.',
  )
}

const TENANT_A = '33333333-3333-3333-3333-333333333333'

async function seedTenantWithOrders(count: number): Promise<string[]> {
  await db.insert(tenants).values({ id: TENANT_A, name: 'Concurrency Co', slug: `concurrency-co-${Date.now()}` })
  const [user] = await db
    .insert(users)
    .values({ tenant_id: TENANT_A, email: `owner-${Date.now()}@example.com`, password_hash: 'hash', role: 'owner', name: 'Owner' })
    .returning()

  const orderIds: string[] = []
  for (let i = 0; i < count; i++) {
    const [order] = await db
      .insert(orders)
      .values({
        tenant_id: TENANT_A,
        created_by: user.id,
        status: 'completed',
        move_date: '2026-06-15',
        from_address: '1 A St',
        to_address: '2 B St',
        home_size: '2br',
        base_price: 480,
        total_price: 480,
      })
      .returning()
    orderIds.push(order.id)
  }
  return orderIds
}

describe.skipIf(!dbAvailable)('generateInvoice concurrency (real Postgres)', () => {
  beforeEach(async () => {
    await db.delete(invoices)
    await db.delete(invoiceCounters)
    await db.delete(orders)
    await db.delete(users)
    await db.delete(tenants)
  })

  it('S6 — concurrent invoice creation for the same tenant never produces duplicate numbers', async () => {
    const orderIds = await seedTenantWithOrders(10)

    const results = await Promise.all(orderIds.map((orderId) => generateInvoice(TENANT_A, orderId)))

    expect(results.every((r) => r !== null)).toBe(true)
    const numbers = results.map((r) => r!.number)
    expect(new Set(numbers).size).toBe(numbers.length)

    const rows = await db.select().from(invoices).where(eq(invoices.tenant_id, TENANT_A))
    expect(rows).toHaveLength(orderIds.length)
    expect(new Set(rows.map((r) => r.number)).size).toBe(rows.length)
  })

  it('S6 — seeds the counter around pre-existing invoice numbers, so a fresh call cannot collide', async () => {
    const [orderId] = await seedTenantWithOrders(1)

    // Simulates a tenant with an invoice already in the table that the counter
    // doesn't know about yet (e.g. seeded by the demo data script, or migrated from
    // before this table existed) — the very first generateInvoice() call for this
    // tenant must not hand out that same number again.
    const [otherOrder] = await db
      .insert(orders)
      .values({
        tenant_id: TENANT_A,
        status: 'completed',
        move_date: '2026-06-15',
        from_address: '1 A St',
        to_address: '2 B St',
        home_size: '2br',
        base_price: 480,
        total_price: 480,
      })
      .returning()
    await db.insert(invoices).values({ tenant_id: TENANT_A, order_id: otherOrder.id, number: 'INV-1001', status: 'draft' })

    const invoice = await generateInvoice(TENANT_A, orderId)

    expect(invoice).not.toBeNull()
    expect(invoice!.number).not.toBe('INV-1001')
  })

  it('S6 — numbers increment sequentially per tenant across repeated calls', async () => {
    const orderIds = await seedTenantWithOrders(3)

    const first = await generateInvoice(TENANT_A, orderIds[0])
    const second = await generateInvoice(TENANT_A, orderIds[1])
    const third = await generateInvoice(TENANT_A, orderIds[2])

    expect(first!.number).toBe('INV-1001')
    expect(second!.number).toBe('INV-1002')
    expect(third!.number).toBe('INV-1003')
  })
})
