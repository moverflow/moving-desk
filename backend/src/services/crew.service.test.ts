import { beforeEach, describe, expect, it, vi } from 'vitest'

// getCrewJobs: select().from().leftJoin().where(cond).orderBy() -> rows
// setCrewJobStatus: update().set(values).where(cond).returning() -> [row]
const { selectRows, whereConds, updateValues, updateWhere, updateReturn } = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  whereConds: [] as unknown[],
  updateValues: [] as unknown[],
  updateWhere: [] as unknown[],
  updateReturn: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  const selectBuilder = {
    from: () => selectBuilder,
    leftJoin: () => selectBuilder,
    where: (cond: unknown) => {
      whereConds.push(cond)
      return { orderBy: () => Promise.resolve(selectRows) }
    },
  }
  return {
    db: {
      select: () => selectBuilder,
      update: () => ({
        set: (values: unknown) => {
          updateValues.push(values)
          return {
            where: (cond: unknown) => {
              updateWhere.push(cond)
              return { returning: () => Promise.resolve(updateReturn) }
            },
          }
        },
      }),
    },
  }
})

const { getCrewJobs, setCrewJobStatus } = await import('./crew.service.js')

function eqPairs(node: unknown, pairs: Array<{ column: string; value: unknown }> = []): Array<{ column: string; value: unknown }> {
  if (!node || typeof node !== 'object') return pairs
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return pairs
  const col = chunks.find(
    (c): c is { name: string } => typeof c === 'object' && c !== null && 'name' in c && 'columnType' in c,
  )
  const param = chunks.find(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      'value' in c &&
      !('columnType' in c) &&
      !Array.isArray((c as { value: unknown }).value),
  ) as { value: unknown } | undefined
  if (col && param) {
    pairs.push({ column: col.name, value: param.value })
    return pairs
  }
  for (const chunk of chunks) eqPairs(chunk, pairs)
  return pairs
}

// Collect every string anywhere in the condition tree (cycle-safe). Param
// values like the today/tomorrow dates and excluded statuses show up here
// regardless of how deeply drizzle nests them.
function allStrings(node: unknown, seen = new Set<unknown>(), acc: string[] = []): string[] {
  if (typeof node === 'string') {
    acc.push(node)
    return acc
  }
  if (!node || typeof node !== 'object' || seen.has(node)) return acc
  seen.add(node)
  for (const value of Object.values(node as Record<string, unknown>)) allStrings(value, seen, acc)
  return acc
}

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const CREW_A = '22222222-2222-2222-2222-222222222222'

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().split('T')[0]
}

beforeEach(() => {
  selectRows.length = 0
  whereConds.length = 0
  updateValues.length = 0
  updateWhere.length = 0
  updateReturn.length = 0
})

describe('getCrewJobs', () => {
  it('AC1/AC3 — filters by tenant, crew, and today+tomorrow move dates', async () => {
    selectRows.push({ id: 'order-1' })

    const rows = await getCrewJobs(TENANT_A, CREW_A)
    expect(rows).toEqual([{ id: 'order-1' }])

    const byColumn = Object.fromEntries(eqPairs(whereConds[0]).map((p) => [p.column, p.value]))
    expect(byColumn.tenant_id).toBe(TENANT_A)
    expect(byColumn.crew_id).toBe(CREW_A)

    const strings = allStrings(whereConds[0])
    expect(strings).toContain(isoDate(0))
    expect(strings).toContain(isoDate(1))
    // Cancelled/closed are excluded from the field view.
    expect(strings).toContain('cancelled')
    expect(strings).toContain('closed')
  })
})

describe('setCrewJobStatus', () => {
  it('AC3 — scopes the update by order id, crew, and tenant', async () => {
    updateReturn.push({ id: 'order-1', status: 'in_progress' })

    const result = await setCrewJobStatus(TENANT_A, CREW_A, 'order-1', 'in_progress')
    expect(result).toEqual({ id: 'order-1', status: 'in_progress' })

    const byColumn = Object.fromEntries(eqPairs(updateWhere[0]).map((p) => [p.column, p.value]))
    expect(byColumn.id).toBe('order-1')
    expect(byColumn.crew_id).toBe(CREW_A)
    expect(byColumn.tenant_id).toBe(TENANT_A)

    const values = updateValues[0] as { status: string; updated_at: Date }
    expect(values.status).toBe('in_progress')
    expect(values.updated_at).toBeInstanceOf(Date)
  })

  it('returns null when no row matches (wrong crew/tenant)', async () => {
    const result = await setCrewJobStatus(TENANT_A, CREW_A, 'order-x', 'completed')
    expect(result).toBeNull()
  })
})
