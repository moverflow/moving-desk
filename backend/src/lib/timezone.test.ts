import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  addDays,
  getTenantToday,
  getTenantTomorrow,
  isValidTimezone,
  resolveTimezone,
} from './timezone.js'

// 6pm Pacific on 14 Aug 2026 — already 01:00 UTC on the 15th. This is the
// window where the old UTC-based logic silently rolled the day over.
const EVENING_IN_LA = new Date('2026-08-15T01:00:00Z')

describe('getTenantToday', () => {
  it('returns the tenant-local date, not the UTC one, in the evening', () => {
    expect(getTenantToday('America/Los_Angeles', EVENING_IN_LA)).toBe('2026-08-14')
    expect(EVENING_IN_LA.toISOString().slice(0, 10)).toBe('2026-08-15')
  })

  it('agrees with UTC when the tenant is on UTC', () => {
    expect(getTenantToday('UTC', EVENING_IN_LA)).toBe('2026-08-15')
  })

  it('handles a tenant east of UTC that has already rolled over', () => {
    // 09:00 in Tokyo on the 15th is still 00:00 UTC on the 15th.
    const morningInTokyo = new Date('2026-08-15T00:00:00Z')
    expect(getTenantToday('Asia/Tokyo', morningInTokyo)).toBe('2026-08-15')
    expect(getTenantToday('America/Los_Angeles', morningInTokyo)).toBe('2026-08-14')
  })

  it('is stable across a US daylight-saving transition', () => {
    // 2026-11-01 is the US fall-back date.
    const beforeDst = new Date('2026-11-01T06:30:00Z') // 11:30pm PDT Oct 31
    const afterDst = new Date('2026-11-01T09:30:00Z') // 1:30am PST Nov 1
    expect(getTenantToday('America/Los_Angeles', beforeDst)).toBe('2026-10-31')
    expect(getTenantToday('America/Los_Angeles', afterDst)).toBe('2026-11-01')
  })

  it('returns a plain YYYY-MM-DD string', () => {
    expect(getTenantToday('America/New_York', EVENING_IN_LA)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('resolveTimezone', () => {
  it('falls back to the default when unset', () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE)
    expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE)
    expect(resolveTimezone('')).toBe(DEFAULT_TIMEZONE)
  })

  it('falls back rather than throwing on a corrupted value', () => {
    // settings.timezone is a free-form string, so this is reachable.
    expect(resolveTimezone('Not/AZone')).toBe(DEFAULT_TIMEZONE)
  })

  it('keeps a valid zone', () => {
    expect(resolveTimezone('America/Los_Angeles')).toBe('America/Los_Angeles')
  })

  it('defaults to the same zone the schema and settings route use', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/New_York')
  })
})

describe('isValidTimezone', () => {
  it('accepts real zones and rejects nonsense', () => {
    expect(isValidTimezone('America/Los_Angeles')).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false)
  })
})

describe('getTenantToday with an invalid zone', () => {
  it('still returns a usable date instead of throwing', () => {
    expect(getTenantToday('Not/AZone', EVENING_IN_LA)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('addDays', () => {
  it('advances one day', () => {
    expect(addDays('2026-08-14', 1)).toBe('2026-08-15')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('goes backwards with a negative offset', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('does not drift across a DST boundary', () => {
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
  })
})

describe('getTenantTomorrow', () => {
  it('is the day after the tenant-local today, not the UTC one', () => {
    expect(getTenantTomorrow('America/Los_Angeles', EVENING_IN_LA)).toBe('2026-08-15')
    // The UTC-based calculation the old code used would have said the 16th.
    expect(getTenantTomorrow('UTC', EVENING_IN_LA)).toBe('2026-08-16')
  })
})
