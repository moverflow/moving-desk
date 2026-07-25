export interface EqPair {
  column: string
  value: unknown
}

// Walks a Drizzle SQL condition tree and pulls out every `eq(column, value)`
// leaf, so a test can assert what a query actually filters on without a real
// database. Used to prove tenant_id is in the WHERE clause.
export function eqPairs(node: unknown, pairs: EqPair[] = []): EqPair[] {
  if (!node || typeof node !== 'object') return pairs
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return pairs

  const col = chunks.find(
    (c): c is { name: string } =>
      typeof c === 'object' && c !== null && 'name' in c && 'columnType' in c,
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

// Column names touched by a condition tree, including those without a bound
// parameter (e.g. `isNull(read_at)`).
export function conditionColumns(node: unknown, names: string[] = []): string[] {
  if (!node || typeof node !== 'object') return names
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return names

  for (const chunk of chunks) {
    if (typeof chunk === 'object' && chunk !== null && 'name' in chunk && 'columnType' in chunk) {
      names.push((chunk as { name: string }).name)
    } else {
      conditionColumns(chunk, names)
    }
  }
  return names
}
