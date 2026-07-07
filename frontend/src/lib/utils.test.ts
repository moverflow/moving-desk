import { describe, it, expect } from 'vitest'
import { getAllTimezones, getGroupedTimezones } from './utils'

describe('getAllTimezones', () => {
  it('returns a non-empty array including America/New_York and Europe/London', () => {
    const zones = getAllTimezones()
    expect(zones.length).toBeGreaterThan(0)
    expect(zones).toContain('America/New_York')
    expect(zones).toContain('Europe/London')
  })
})

describe('getGroupedTimezones', () => {
  it('groups entries under the correct region key', () => {
    const grouped = getGroupedTimezones()
    expect(grouped['America']).toContain('America/New_York')
    expect(grouped['Europe']).toContain('Europe/London')
    expect(grouped['Asia']).toContain('Asia/Tbilisi')
  })

  it('every returned timezone appears under its correct region prefix', () => {
    const grouped = getGroupedTimezones()
    for (const [region, zones] of Object.entries(grouped)) {
      for (const tz of zones) {
        expect(tz.startsWith(`${region}/`)).toBe(true)
      }
    }
  })

  it('accounts for every timezone returned by getAllTimezones with no duplicates or losses', () => {
    const all = getAllTimezones()
    const grouped = getGroupedTimezones()
    const flattened = Object.values(grouped).flat()
    expect(flattened.sort()).toEqual([...all].sort())
  })
})
