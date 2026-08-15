import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conditionColumns, eqPairs } from '../test/drizzleConditions.js'

// Same shape of fake as notifications.service.test.ts: single-table reads and
// writes, with every WHERE captured so the tests can prove tenant_id and
// used_at are actually part of it.
const { selectQueue, selectWheres, insertValues, updateWheres, updateSets, updateReturns } =
  vi.hoisted(() => ({
    selectQueue: [] as unknown[][],
    selectWheres: [] as unknown[],
    insertValues: [] as unknown[],
    updateWheres: [] as unknown[],
    updateSets: [] as unknown[],
    updateReturns: [] as unknown[][],
  }))

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          selectWheres.push(cond)
          const rows = selectQueue.shift() ?? []
          const promise = Promise.resolve(rows) as Promise<unknown[]> & {
            limit: (n: number) => Promise<unknown[]>
          }
          promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
          return promise
        },
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
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
            const promise = Promise.resolve() as Promise<unknown> & {
              returning: () => Promise<unknown[]>
            }
            promise.returning = () => Promise.resolve(updateReturns.shift() ?? [])
            return promise
          },
        }
      },
    }),
  },
}))

vi.mock('../lib/env.js', () => ({
  env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_BOT_USERNAME: 'movingdesk_test_bot' },
}))

vi.mock('../lib/telegram.js', () => ({
  isTelegramEnabled: () => true,
  telegramDeepLink: (code: string) => `https://t.me/movingdesk_test_bot?start=${code}`,
}))

// The booking channel resolves its tenant through the public booking service, so
// the booking_enabled gate lives in exactly one place. Mocked here to prove that
// service is the one consulted, rather than a second lookup of its own.
const getPublicTenantMock = vi.fn()
vi.mock('./booking.service.js', () => ({
  getPublicTenant: (...a: unknown[]) => getPublicTenantMock(...a),
}))

const {
  consumeLinkCode,
  createLinkCode,
  getTelegramStatus,
  handleStartCommand,
  listTenantChatIds,
  resolveStartCommand,
  unlinkTelegram,
} = await import('./telegram.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '99999999-9999-9999-9999-999999999999'
const USER_A = '22222222-2222-2222-2222-222222222222'
const CODE_ID = '33333333-3333-4333-8333-333333333333'

function reset(): void {
  selectQueue.length = 0
  selectWheres.length = 0
  insertValues.length = 0
  updateWheres.length = 0
  updateSets.length = 0
  updateReturns.length = 0
  getPublicTenantMock.mockReset()
}

beforeEach(reset)

describe('createLinkCode', () => {
  it('issues a code scoped to the requesting tenant and user', async () => {
    const result = await createLinkCode(TENANT_A, USER_A)

    expect(result.code).toMatch(/^[A-Z2-9]{8}$/)
    expect(result.deepLink).toBe(`https://t.me/movingdesk_test_bot?start=${result.code}`)
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())

    expect(insertValues[0]).toMatchObject({
      tenant_id: TENANT_A,
      user_id: USER_A,
      code: result.code,
    })
  })

  it('invalidates the user\'s outstanding codes before issuing a new one', async () => {
    await createLinkCode(TENANT_A, USER_A)

    expect(updateSets[0]).toHaveProperty('used_at')
    const where = eqPairs(updateWheres[0])
    expect(where).toContainEqual({ column: 'tenant_id', value: TENANT_A })
    expect(where).toContainEqual({ column: 'user_id', value: USER_A })
    expect(conditionColumns(updateWheres[0])).toContain('used_at')
  })

  it('never repeats a code across calls', async () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      codes.add((await createLinkCode(TENANT_A, USER_A)).code)
    }
    expect(codes.size).toBe(20)
  })
})

describe('consumeLinkCode', () => {
  const future = new Date(Date.now() + 60_000)

  function queueCode(expiresAt: Date = future): void {
    selectQueue.push([
      { id: CODE_ID, tenantId: TENANT_A, userId: USER_A, expiresAt },
    ])
  }

  it('links the chat to the code\'s user and burns the code', async () => {
    queueCode()
    updateReturns.push([{ name: 'Dana Owner' }])

    const result = await consumeLinkCode('ABCD2345', '5550001')

    expect(result).toEqual({ status: 'linked', name: 'Dana Owner' })
    expect(updateSets[0]).toEqual({ telegram_chat_id: '5550001' })

    // The user row is updated by id AND tenant_id — a code can only ever touch
    // the tenant it was issued for.
    const userWhere = eqPairs(updateWheres[0])
    expect(userWhere).toContainEqual({ column: 'id', value: USER_A })
    expect(userWhere).toContainEqual({ column: 'tenant_id', value: TENANT_A })
    expect(conditionColumns(updateWheres[0])).toContain('deleted_at')

    expect(updateSets[1]).toHaveProperty('used_at')
    const codeWhere = eqPairs(updateWheres[1])
    expect(codeWhere).toContainEqual({ column: 'tenant_id', value: TENANT_A })
    expect(codeWhere).toContainEqual({ column: 'id', value: CODE_ID })
  })

  it('accepts a lowercase code typed by hand', async () => {
    queueCode()
    updateReturns.push([{ name: 'Dana Owner' }])

    await consumeLinkCode('abcd2345', '5550001')

    expect(eqPairs(selectWheres[0])).toContainEqual({ column: 'code', value: 'ABCD2345' })
  })

  it('only looks at codes that have not been used', async () => {
    queueCode()
    updateReturns.push([{ name: 'Dana Owner' }])

    await consumeLinkCode('ABCD2345', '5550001')

    expect(conditionColumns(selectWheres[0])).toContain('used_at')
  })

  it('rejects an unknown code without touching any user', async () => {
    selectQueue.push([])

    expect(await consumeLinkCode('NOPE1234', '5550001')).toEqual({ status: 'invalid' })
    expect(updateSets).toHaveLength(0)
  })

  it('rejects an expired code without linking', async () => {
    queueCode(new Date(Date.now() - 1_000))

    expect(await consumeLinkCode('ABCD2345', '5550001')).toEqual({ status: 'expired' })
    expect(updateSets).toHaveLength(0)
  })

  it('burns the code but reports invalid when the user was removed', async () => {
    queueCode()
    updateReturns.push([])

    expect(await consumeLinkCode('ABCD2345', '5550001')).toEqual({ status: 'invalid' })
    expect(updateSets[1]).toHaveProperty('used_at')
  })
})

describe('handleStartCommand', () => {
  it('explains how to connect when no code is sent', async () => {
    const reply = await handleStartCommand('', '5550001')

    expect(reply).toContain('Settings → Integrations')
    expect(selectWheres).toHaveLength(0)
  })

  it('confirms by name on success', async () => {
    selectQueue.push([
      { id: CODE_ID, tenantId: TENANT_A, userId: USER_A, expiresAt: new Date(Date.now() + 60_000) },
    ])
    updateReturns.push([{ name: 'Dana Owner' }])

    expect(await handleStartCommand(' ABCD2345 ', '5550001')).toContain('Dana Owner')
  })

  it('tells the owner to regenerate an expired code', async () => {
    selectQueue.push([
      { id: CODE_ID, tenantId: TENANT_A, userId: USER_A, expiresAt: new Date(Date.now() - 1) },
    ])

    expect(await handleStartCommand('ABCD2345', '5550001')).toContain('expired')
  })

  it('reports an unusable code without leaking whether it ever existed', async () => {
    selectQueue.push([])

    const reply = await handleStartCommand('NOPE1234', '5550001')
    expect(reply).toContain('not valid or has already been used')
  })
})

describe('resolveStartCommand', () => {
  // AC: start_param → tenant resolution.
  it('resolves book_<slug> to that company and offers the booking Mini App', async () => {
    getPublicTenantMock.mockResolvedValue({ id: TENANT_A, name: 'Best Movers', slug: 'best-movers' })

    const reply = await resolveStartCommand('book_best-movers', '5550001')

    expect(getPublicTenantMock).toHaveBeenCalledWith('best-movers')
    expect(reply).toEqual({
      kind: 'booking',
      text: expect.stringContaining('Best Movers'),
      slug: 'best-movers',
      companyName: 'Best Movers',
    })
  })

  // AC: the booking_enabled gate is not bypassed by the new channel.
  // getPublicTenant returns null both for an unknown slug and for a tenant with
  // booking switched off, so one branch covers both.
  it('refuses a slug the public booking service will not serve', async () => {
    getPublicTenantMock.mockResolvedValue(null)

    const reply = await resolveStartCommand('book_booking-disabled-co', '5550001')

    expect(reply.kind).toBe('text')
    expect(reply.text).toContain('not valid')
  })

  it('does not look up a tenant for an empty booking slug', async () => {
    const reply = await resolveStartCommand('book_', '5550001')

    expect(getPublicTenantMock).not.toHaveBeenCalled()
    expect(reply.kind).toBe('text')
  })

  // The two channels share the /start payload, so the connect-code path must be
  // untouched — a code can never carry the book_ prefix (see CODE_ALPHABET).
  it('still links an owner account when the payload is a connect code', async () => {
    selectQueue.push([
      { id: CODE_ID, tenantId: TENANT_A, userId: USER_A, expiresAt: new Date(Date.now() + 60_000) },
    ])
    updateReturns.push([{ name: 'Dana Owner' }])

    const reply = await resolveStartCommand('ABCD2345', '5550001')

    expect(reply.kind).toBe('text')
    expect(reply.text).toContain('Dana Owner')
    expect(getPublicTenantMock).not.toHaveBeenCalled()
  })

  it('falls back to the welcome text for a bare /start', async () => {
    const reply = await resolveStartCommand('', '5550001')

    expect(reply.kind).toBe('text')
    expect(reply.text).toContain('Settings → Integrations')
  })
})

describe('getTelegramStatus', () => {
  it('reads the user row scoped to the tenant', async () => {
    selectQueue.push([{ chatId: '5550001' }])

    const status = await getTelegramStatus(TENANT_A, USER_A)

    expect(status).toEqual({
      enabled: true,
      connected: true,
      botUsername: 'movingdesk_test_bot',
    })
    const where = eqPairs(selectWheres[0])
    expect(where).toContainEqual({ column: 'id', value: USER_A })
    expect(where).toContainEqual({ column: 'tenant_id', value: TENANT_A })
  })

  it('reports disconnected for a user in another tenant', async () => {
    selectQueue.push([])

    const status = await getTelegramStatus(TENANT_B, USER_A)

    expect(status.connected).toBe(false)
  })
})

describe('unlinkTelegram', () => {
  it('clears the chat id only within the caller\'s tenant', async () => {
    await unlinkTelegram(TENANT_A, USER_A)

    expect(updateSets[0]).toEqual({ telegram_chat_id: null })
    const where = eqPairs(updateWheres[0])
    expect(where).toContainEqual({ column: 'id', value: USER_A })
    expect(where).toContainEqual({ column: 'tenant_id', value: TENANT_A })
  })
})

describe('listTenantChatIds', () => {
  it('filters by tenant and skips unlinked or removed users', async () => {
    selectQueue.push([{ chatId: '5550001' }, { chatId: '5550002' }])

    expect(await listTenantChatIds(TENANT_A)).toEqual(['5550001', '5550002'])

    expect(eqPairs(selectWheres[0])).toContainEqual({ column: 'tenant_id', value: TENANT_A })
    const columns = conditionColumns(selectWheres[0])
    expect(columns).toContain('telegram_chat_id')
    expect(columns).toContain('deleted_at')
  })

  it('sends one message per chat when two accounts share a Telegram', async () => {
    selectQueue.push([{ chatId: '5550001' }, { chatId: '5550001' }])

    expect(await listTenantChatIds(TENANT_A)).toEqual(['5550001'])
  })
})
