# Task: Company Settings + Team Management
**Sprint:** 4
**Scope:** both
**ID:** sprint-4/02-settings

## Backend endpoints

### GET /settings — tenant settings (owner only)
### PATCH /settings — update name, timezone, baseRates, logo_url

### POST /settings/logo — upload logo to Cloudflare R2
Returns { url } for logo_url

### GET /users — list team members (owner only)
### DELETE /users/:id — remove user (owner only, cannot remove self)

## Frontend

### Settings page (owner only — extra nav tab)

#### Company tab
  Logo upload with preview
  Company name
  Timezone select (US timezones)
  Base rates per home size (number inputs):
    Studio: $___
    1 BR: $___
    2 BR: $___
    3 BR: $___
    House: $___

#### Team tab
  List of users with role badges
  Invite button → email input → POST /users/invite
  Remove button (owner only, grayed out on self)

#### Billing tab
  Current plan badge
  Trial countdown (if trial)
  Upgrade button → POST /billing/checkout
  Manage billing → POST /billing/portal

## Trial countdown banner
Shows on all pages when trial < 5 days remaining.
"X days left in your trial. Upgrade now →"

## Read-only mode
When trial_expired and no active subscription:
  All inputs disabled
  Banner: "Your trial has ended. Upgrade to continue."
  Only billing page is accessible.

## Acceptance criteria
- AC1: Logo uploads and shows in invoices
- AC2: Base rates save and reflect in new order price calculation
- AC3: Invite sends email, new user appears in team list
- AC4: Remove user revokes their access immediately
- AC5: Trial banner appears with correct days remaining
- AC6: Read-only mode disables all form inputs

---

## Mock mode — Frontend only (use until backend is ready)

### Mock data
```typescript
// hooks/useSettings.ts
const MOCK_SETTINGS = {
  companyName: 'Best & Pro Moving Service',
  logoUrl: null as string | null,
  timezone: 'America/Los_Angeles',
  baseRates: {
    studio: 280,
    '1br': 380,
    '2br': 480,
    '3br': 620,
    house: 850,
  },
}

const MOCK_TEAM = [
  {
    id: 'user-1',
    name: 'John Smith',
    email: 'john@bestmovers.com',
    role: 'owner' as const,
  },
  {
    id: 'user-2',
    name: 'Maria Garcia',
    email: 'maria@bestmovers.com',
    role: 'dispatcher' as const,
  },
]

const MOCK_SUBSCRIPTION = {
  plan: 'trial' as const,
  status: 'trialing' as const,
  trialEndsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  // 8 days left — will show trial banner
}
```

### Mock hooks
```typescript
export const useSettings = () => useQuery({
  queryKey: ['settings'],
  queryFn: async () => MOCK_SETTINGS
})

export const useUpdateSettings = () => useMutation({
  mutationFn: async (data: Partial<typeof MOCK_SETTINGS>) => {
    await new Promise(r => setTimeout(r, 400))
    Object.assign(MOCK_SETTINGS, data)
    return MOCK_SETTINGS
  }
})

export const useTeam = () => useQuery({
  queryKey: ['team'],
  queryFn: async () => MOCK_TEAM
})

export const useSubscription = () => useQuery({
  queryKey: ['subscription'],
  queryFn: async () => MOCK_SUBSCRIPTION
})
```

### Trial banner logic (works with mock)
```typescript
// components/shared/TrialBanner.tsx
// Show when: plan === 'trial' AND daysLeft <= 5
const daysLeft = Math.ceil(
  (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
)
// MOCK has 8 days → banner hidden
// Change MOCK_SUBSCRIPTION.trialEndsAt to 3 days to test banner
```

### Sync checklist (when backend is ready)
- [ ] Replace useSettings with GET /settings
- [ ] Replace useUpdateSettings with PATCH /settings
- [ ] Replace useTeam with GET /users
- [ ] Replace useSubscription with GET /billing/subscription
- [ ] Wire logo upload to POST /settings/logo
- [ ] Wire invite button to POST /users/invite
- [ ] Wire upgrade button to POST /billing/checkout
