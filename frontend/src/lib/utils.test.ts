import { describe, it, expect } from 'vitest'
import { formatDate, formatTimestamp, getAllTimezones, getGroupedTimezones } from './utils'

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

describe('formatDate vs formatTimestamp', () => {
  it('formatDate renders a bare move_date without shifting the day', () => {
    // move_date is a bare calendar date parsed as UTC midnight. Rendering it in
    // UTC is what stops it displaying as the previous day west of Greenwich.
    expect(formatDate(new Date('2026-06-15T00:00:00Z'))).toBe('Jun 15, 2026')
  })

  it('formatDate is stable regardless of the viewer, since it pins UTC', () => {
    expect(formatDate(new Date('2026-12-31T00:00:00Z'))).toBe('Dec 31, 2026')
  })

  it('formatTimestamp renders an instant in the viewer local zone', () => {
    const instant = new Date('2026-06-15T18:30:00Z')
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(instant)
    expect(formatTimestamp(instant)).toBe(expected)
  })

  it('formatTimestamp does not force UTC the way formatDate does', () => {
    // An invoice created at 5pm Pacific is 00:00 UTC the next day. Forcing UTC
    // showed the customer tomorrow's date on today's invoice.
    const lateEveningPacific = new Date('2026-06-16T00:30:00Z')
    const asUtc = formatDate(lateEveningPacific)
    const asLocal = formatTimestamp(lateEveningPacific)
    const offset = lateEveningPacific.getTimezoneOffset()
    if (offset > 30) {
      expect(asLocal).not.toBe(asUtc)
    } else {
      expect(asLocal).toBe(asUtc)
    }
  })
})
