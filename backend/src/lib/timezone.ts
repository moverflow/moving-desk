// Matches the default in settings.service DEFAULT_SETTINGS and the fallback the
// settings route returns, so a tenant that never picked a timezone behaves the
// same everywhere.
export const DEFAULT_TIMEZONE = 'America/New_York'

// en-CA formats as YYYY-MM-DD, so this yields the calendar date in the given
// zone directly — no offset arithmetic, and DST is handled by Intl.
function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// tenant.settings.timezone is a free-form string, so an unrecognised or
// corrupted value must not take down a crew's job list or the reminder job.
export function isValidTimezone(timezone: string): boolean {
  try {
    formatInZone(new Date(), timezone)
    return true
  } catch {
    return false
  }
}

export function resolveTimezone(timezone?: string | null): string {
  if (!timezone) return DEFAULT_TIMEZONE
  return isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
}

// The calendar date it is *right now* for the tenant. This is the boundary that
// matters: at 5pm in California the UTC date has already rolled over, so a
// UTC-based "today" drops the jobs the crew is still working.
export function getTenantToday(timezone?: string | null, now: Date = new Date()): string {
  return formatInZone(now, resolveTimezone(timezone))
}

// Calendar arithmetic on a bare YYYY-MM-DD. Anchored at UTC midnight, which has
// no DST, so adding days can never shift by an hour and land on the wrong date.
export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function getTenantTomorrow(timezone?: string | null, now: Date = new Date()): string {
  return addDays(getTenantToday(timezone, now), 1)
}
