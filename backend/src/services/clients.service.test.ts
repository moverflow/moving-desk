import { beforeEach, describe, expect, it, vi } from 'vitest'

// Real Postgres enforces the uniqueness of (tenant_id, phone) at the DB level
// (see clients_tenant_phone_idx in db/schema.ts) — there is no local Postgres
// available in this test run, so this fake mirrors that exact constraint
// in memory rather than stubbing per-test return values, to give the
// tenant-isolation assertions below real behavioral coverage.
const { fakeDb } = vi.hoisted(() => {
  type Row = Record<string, unknown>

  function isColumn(x: unknown): x is { name: string } {
    return (
      typeof x === 'object' &&
      x !== null &&
      'name' in x &&
      'columnType' in x &&
      typeof (x as { name: unknown }).name === 'string'
    )
  }

  function collectEqPairs(node: unknown, pairs: Array<{ column: string; value: unknown }>): void {
    if (!node || typeof node !== 'object') return
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks
    if (!Array.isArray(chunks)) return

    const columnChunk = chunks.find(isColumn)
    if (columnChunk) {
      const paramChunk = chunks.find(
        (c) =>
          c !== null &&
          typeof c === 'object' &&
          'value' in c &&
          !Array.isArray((c as { value: unknown }).value) &&
          !isColumn(c)
      ) as { value: unknown } | undefined
      if (paramChunk) {
        pairs.push({ column: columnChunk.name, value: paramChunk.value })
        return
      }
    }
    for (const chunk of chunks) collectEqPairs(chunk, pairs)
  }

  function matchesCondition(cond: unknown, row: Row): boolean {
    const pairs: Array<{ column: string; value: unknown }> = []
    collectEqPairs(cond, pairs)
    return pairs.every((p) => row[p.column] === p.value)
  }

  function whereResult(list: Row[]): Promise<Row[]> & { limit: (n: number) => Promise<Row[]> } {
    const promise = Promise.resolve(list) as Promise<Row[]> & { limit: (n: number) => Promise<Row[]> }
    promise.limit = (n: number) => Promise.resolve(list.slice(0, n))
    return promise
  }

  function createFakeDb() {
    const store = new Map<unknown, Row[]>()

    function rowsFor(table: unknown): Row[] {
      let list = store.get(table)
      if (!list) {
        list = []
        store.set(table, list)
      }
      return list
    }

    return {
      _store: store,
      select: () => ({
        from: (table: unknown) => ({
          where: (cond: unknown) => whereResult(rowsFor(table).filter((r) => matchesCondition(cond, r))),
        }),
      }),
      insert: (table: unknown) => ({
        values: (value: Row) => ({
          returning: (): Promise<Row[]> => {
            const list = rowsFor(table)
            if (value.phone && list.some((r) => r.tenant_id === value.tenant_id && r.phone === value.phone)) {
              const err = new Error('duplicate key value violates unique constraint "clients_tenant_phone_idx"')
              ;(err as unknown as { code: string }).code = '23505'
              return Promise.reject(err)
            }
            const created: Row = {
              id: `client-${list.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
              created_at: new Date(),
              updated_at: new Date(),
              ...value,
            }
            list.push(created)
            return Promise.resolve([created])
          },
        }),
      }),
    }
  }

  return { fakeDb: createFakeDb() }
})

vi.mock('../db/index.js', () => ({ db: fakeDb }))
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { createClient, getClientById } = await import('./clients.service.js')
const { clients, orders } = await import('../db/schema.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  fakeDb._store.get(clients)?.splice(0)
  fakeDb._store.get(orders)?.splice(0)
})

describe('createClient', () => {
  it('creates a client for the tenant — happy path', async () => {
    const client = await createClient(TENANT_A, { name: 'Jane Doe', phone: '5551234' })
    expect(client).not.toBeNull()
    expect(client?.name).toBe('Jane Doe')
    expect(client?.phone).toBe('5551234')
    expect(client?.tenant_id).toBe(TENANT_A)
  })

  it('returns null for a duplicate phone within the same tenant', async () => {
    const first = await createClient(TENANT_A, { name: 'Jane Doe', phone: '5551234' })
    const second = await createClient(TENANT_A, { name: 'Someone Else', phone: '5551234' })
    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it('allows two different tenants to create a client with the same phone number', async () => {
    const a = await createClient(TENANT_A, { name: 'Jane Doe', phone: '5551234' })
    const b = await createClient(TENANT_B, { name: 'John Smith', phone: '5551234' })
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a?.tenant_id).toBe(TENANT_A)
    expect(b?.tenant_id).toBe(TENANT_B)
  })

  it('does not falsely collide when phone is omitted for multiple clients in the same tenant', async () => {
    const a = await createClient(TENANT_A, { name: 'No Phone One' })
    const b = await createClient(TENANT_A, { name: 'No Phone Two' })
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a?.phone).toBeUndefined()
    expect(b?.phone).toBeUndefined()
  })

  it('does not expose a client created by another tenant', async () => {
    const created = await createClient(TENANT_A, { name: 'Jane Doe', phone: '5551234' })
    const seenByOtherTenant = await getClientById(TENANT_B, created?.id as string)
    expect(seenByOtherTenant).toBeNull()
    const seenByOwner = await getClientById(TENANT_A, created?.id as string)
    expect(seenByOwner?.id).toBe(created?.id)
  })
})
