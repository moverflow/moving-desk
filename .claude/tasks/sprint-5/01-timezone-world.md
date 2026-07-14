# Task: Timezone — full world list
**Sprint:** 5
**Scope:** frontend
**ID:** sprint-5/01-timezone-world

## User story
As an owner setting up my company, I want to select my timezone from
a full world list, not just US timezones, so companies outside the US
can use MovingDesk correctly.

## What to build

### Replace hardcoded US timezone list with full world list

In QuickSetupPage and SettingsPage, the timezone select currently has
a hardcoded list of ~6 US timezones. Replace with dynamic full list:

```typescript
// lib/utils.ts — add this function
export function getAllTimezones(): string[] {
  return Intl.supportedValuesOf('timeZone')
}
```

The select component should render all timezones from this function.

### Group by region for better UX

Raw `Intl.supportedValuesOf('timeZone')` returns ~600 entries like
`America/New_York`, `Europe/London`, `Asia/Tbilisi` etc.

Group them by continent prefix for readability:

```typescript
export function getGroupedTimezones(): Record<string, string[]> {
  const all = Intl.supportedValuesOf('timeZone')
  return all.reduce((acc, tz) => {
    const region = tz.split('/')[0]
    if (!acc[region]) acc[region] = []
    acc[region].push(tz)
    return acc
  }, {} as Record<string, string[]>)
}
```

Render as `<optgroup>` or shadcn grouped select:
```
America/
  America/New_York
  America/Los_Angeles
  America/Chicago
  ...
Europe/
  Europe/London
  Europe/Paris
  Europe/Tbilisi  ← owner in Georgia will find this
  ...
```

### Default value
Keep `America/New_York` as default for new registrations (US market
primary). But if owner changes it — save correctly.

### Display format
Show timezone as-is (`America/New_York`) — do NOT try to add UTC offset
labels, that adds complexity without enough value for v1.

## Files to modify
```
frontend/src/lib/utils.ts — add getAllTimezones(), getGroupedTimezones()
frontend/src/routes/QuickSetupPage.tsx — replace hardcoded list
frontend/src/routes/SettingsPage.tsx — replace hardcoded list
```

## Acceptance criteria
- AC1: Timezone select shows all ~600 world timezones
- AC2: Options are grouped by region (America, Europe, Asia, etc.)
- AC3: Default remains America/New_York for new registrations
- AC4: `npm run typecheck` passes with zero errors
- AC5: No new dependencies added — uses built-in Intl API only
