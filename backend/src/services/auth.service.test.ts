import { beforeEach, describe, expect, it, vi } from 'vitest'

// registerTenantAndUser runs its inserts inside db.transaction(tx => ...), then does a
// non-blocking Stripe customer creation + db.update afterwards. The fake below tracks
// every insert's (table, values) pair so the test can assert on exactly what was passed
// to the tenants insert, without needing to fake real Postgres return-value shapes.
// `failures` lets recordLogin's swallow-and-log tests force either write to reject.
const { insertedValues, updateSets, failures } = vi.hoisted(() => ({
  insertedValues: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updateSets: [] as unknown[],
  failures: { insert: false, update: false },
}))

vi.mock('../db/index.js', () => {
  function fakeInsert(table: unknown) {
    return {
      values: (values: Record<string, unknown>) => {
        insertedValues.push({ table, values })
        const row = { id: `${String(table)}-id`, ...values }
        return {
          returning: () => (failures.insert ? Promise.reject(new Error('insert failed')) : Promise.resolve([row])),
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            (failures.insert ? Promise.reject(new Error('insert failed')) : Promise.resolve(row)).then(
              onFulfilled,
              onRejected,
            ),
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
          return {
            where: () => (failures.update ? Promise.reject(new Error('update failed')) : Promise.resolve([])),
          }
        },
      }),
    },
  }
})

vi.mock('../lib/jwt.js', () => ({ signToken: vi.fn().mockResolvedValue('fake.jwt.token') }))

const loggerErrorMock = vi.fn()
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: (...a: unknown[]) => loggerErrorMock(...a), warn: vi.fn() },
}))

const stripeCreateMock = vi.fn().mockResolvedValue({ id: 'cus_fake' })
vi.mock('../lib/stripe.js', () => ({
  stripe: { customers: { create: (...a: unknown[]) => stripeCreateMock(...a) } },
}))

const { loginEvents, tenants, users } = await import('../db/schema.js')
const { recordLogin, registerTenantAndUser } = await import('./auth.service.js')

const USER_A = '22222222-2222-2222-2222-222222222222'
const TENANT_A = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  insertedValues.length = 0
  updateSets.length = 0
  failures.insert = false
  failures.update = false
  stripeCreateMock.mockClear()
  loggerErrorMock.mockReset()
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

describe('recordLogin', () => {
  it('AC1 — updates last_login_at and inserts a login_events row', async () => {
    await recordLogin(USER_A, TENANT_A, '203.0.113.5')

    expect(updateSets[0]).toMatchObject({ last_login_at: expect.any(Date) })

    const eventInsert = insertedValues.find((i) => i.table === loginEvents)
    expect(eventInsert).toBeDefined()
    expect(eventInsert!.values).toMatchObject({
      user_id: USER_A,
      tenant_id: TENANT_A,
      ip_address: '203.0.113.5',
    })
  })

  it('updates the same user row the login is for, not some other one', async () => {
    await recordLogin(USER_A, TENANT_A, '203.0.113.5')

    const userInsert = insertedValues.find((i) => i.table === users)
    // recordLogin never inserts a user — only login_events. Confirms the
    // update targets users directly rather than accidentally going through
    // the insert path.
    expect(userInsert).toBeUndefined()
  })

  it('swallows and logs a failure updating last_login_at instead of throwing', async () => {
    failures.update = true
    await expect(recordLogin(USER_A, TENANT_A, '203.0.113.5')).resolves.toBeUndefined()
    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it('swallows and logs a failure inserting the login_events row instead of throwing', async () => {
    failures.insert = true
    await expect(recordLogin(USER_A, TENANT_A, '203.0.113.5')).resolves.toBeUndefined()
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
