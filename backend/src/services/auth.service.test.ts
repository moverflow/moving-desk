import { beforeEach, describe, expect, it, vi } from 'vitest'

// registerTenantAndUser runs its inserts inside db.transaction(tx => ...), then does a
// non-blocking Stripe customer creation + db.update afterwards. The fake below tracks
// every insert's (table, values) pair so the test can assert on exactly what was passed
// to the tenants insert, without needing to fake real Postgres return-value shapes.
const { insertedValues, updateSets } = vi.hoisted(() => ({
  insertedValues: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updateSets: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  function fakeInsert(table: unknown) {
    return {
      values: (values: Record<string, unknown>) => {
        insertedValues.push({ table, values })
        const row = { id: `${String(table)}-id`, ...values }
        return {
          returning: () => Promise.resolve([row]),
          then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(row).then(onFulfilled),
        }
      },
    }
  }

  interface FakeTx {
    insert: typeof fakeInsert
  }
  const tx: FakeTx = { insert: fakeInsert }

  return {
    db: {
      transaction: (fn: (tx: FakeTx) => Promise<unknown>) => fn(tx),
      insert: fakeInsert,
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return { where: () => Promise.resolve([]) }
        },
      }),
    },
  }
})

vi.mock('../lib/jwt.js', () => ({ signToken: vi.fn().mockResolvedValue('fake.jwt.token') }))
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const stripeCreateMock = vi.fn().mockResolvedValue({ id: 'cus_fake' })
vi.mock('../lib/stripe.js', () => ({
  stripe: { customers: { create: (...a: unknown[]) => stripeCreateMock(...a) } },
}))

const { tenants } = await import('../db/schema.js')
const { registerTenantAndUser } = await import('./auth.service.js')

beforeEach(() => {
  insertedValues.length = 0
  updateSets.length = 0
  stripeCreateMock.mockClear()
})

describe('registerTenantAndUser', () => {
  it('creates every new tenant with booking_enabled: true, so /book/:slug works immediately', async () => {
    await registerTenantAndUser({
      companyName: 'Best Movers',
      email: 'owner@bestmovers.com',
      passwordHash: 'hash',
      name: 'Owner',
      slug: 'best-movers',
    })

    const tenantInsert = insertedValues.find((i) => i.table === tenants)
    expect(tenantInsert).toBeDefined()
    expect(tenantInsert!.values).toMatchObject({ booking_enabled: true })
  })

  it('still sets the tenant on a 14-day trial with the expected plan', async () => {
    await registerTenantAndUser({
      companyName: 'Best Movers',
      email: 'owner@bestmovers.com',
      passwordHash: 'hash',
      name: 'Owner',
      slug: 'best-movers',
    })

    const tenantInsert = insertedValues.find((i) => i.table === tenants)
    expect(tenantInsert!.values).toMatchObject({ plan: 'trial', slug: 'best-movers' })
    expect(tenantInsert!.values.trial_ends_at).toBeInstanceOf(Date)
  })
})
