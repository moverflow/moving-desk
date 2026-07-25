import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'

// The ordering check is a MAX(created) aggregation across rows — too easy to fake
// wrong in memory (the whole point is testing that the SQL comparison is correct),
// so this runs against a real local Postgres instance, same skip-if-unreachable
// convention as dashboard.service.test.ts.
const TEST_DATABASE_URL =
  process.env.STRIPE_EVENTS_TEST_DATABASE_URL ?? 'postgresql://localhost:5432/movingdesk_test'

vi.mock('../db/index.js', async () => {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schemaModule = await import('../db/schema.js')
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  return { db: drizzle(pool, { schema: schemaModule }) }
})

const { db } = await import('../db/index.js')
const { stripeEvents } = await import('../db/schema.js')
const { claimStripeEvent } = await import('./stripe-events.service.js')

let dbAvailable = true
try {
  await db.execute(sql`select 1`)
} catch {
  dbAvailable = false
  // eslint-disable-next-line no-console
  console.warn(
    `[stripe-events.service.test.ts] skipping — no Postgres reachable at ${TEST_DATABASE_URL}. ` +
      'Run migrations against a local test DB to enable these tests.',
  )
}

describe.skipIf(!dbAvailable)('claimStripeEvent (real Postgres)', () => {
  beforeEach(async () => {
    await db.delete(stripeEvents)
  })

  it('S3 — processes a brand-new event', async () => {
    const result = await claimStripeEvent({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-01T00:00:00Z'),
      customerId: 'cus_1',
    })
    expect(result).toBe('process')
  })

  it('S3 — reports a redelivered event id as a duplicate, not stale', async () => {
    const params = {
      id: 'evt_1',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-01T00:00:00Z'),
      customerId: 'cus_1',
    }
    expect(await claimStripeEvent(params)).toBe('process')
    expect(await claimStripeEvent(params)).toBe('duplicate')
  })

  it('S3 — flags an out-of-order subscription event as stale, does not regress status', async () => {
    await claimStripeEvent({
      id: 'evt_newer',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-10T00:00:00Z'),
      customerId: 'cus_1',
    })

    const result = await claimStripeEvent({
      id: 'evt_older',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-05T00:00:00Z'),
      customerId: 'cus_1',
    })

    expect(result).toBe('stale')
  })

  it('S3 — a later event for the same customer after a stale one is still processed', async () => {
    await claimStripeEvent({
      id: 'evt_newer',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-10T00:00:00Z'),
      customerId: 'cus_1',
    })
    await claimStripeEvent({
      id: 'evt_older',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-05T00:00:00Z'),
      customerId: 'cus_1',
    })

    const result = await claimStripeEvent({
      id: 'evt_newest',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-15T00:00:00Z'),
      customerId: 'cus_1',
    })

    expect(result).toBe('process')
  })

  it('S3 — ordering is scoped per customer, not global', async () => {
    await claimStripeEvent({
      id: 'evt_a_newer',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-10T00:00:00Z'),
      customerId: 'cus_a',
    })

    // An older event for a *different* customer must not be treated as stale just
    // because a newer event exists for cus_a.
    const result = await claimStripeEvent({
      id: 'evt_b_older',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-01T00:00:00Z'),
      customerId: 'cus_b',
    })

    expect(result).toBe('process')
  })

  it('R2 — ordering does not apply to checkout events unrelated to subscription status', async () => {
    await claimStripeEvent({
      id: 'evt_sub_newer',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-10T00:00:00Z'),
      customerId: 'cus_1',
    })

    // An "older" checkout.session.completed for the same customer must still be
    // processed — it doesn't touch subscription status, so it's not order-sensitive.
    const result = await claimStripeEvent({
      id: 'evt_checkout_older',
      type: 'checkout.session.completed',
      created: new Date('2026-01-01T00:00:00Z'),
      customerId: 'cus_1',
    })

    expect(result).toBe('process')
  })

  it('S3 — events with no customer id are never treated as stale', async () => {
    await claimStripeEvent({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-10T00:00:00Z'),
      customerId: null,
    })

    const result = await claimStripeEvent({
      id: 'evt_2',
      type: 'customer.subscription.updated',
      created: new Date('2026-01-01T00:00:00Z'),
      customerId: null,
    })

    expect(result).toBe('process')
  })
})
