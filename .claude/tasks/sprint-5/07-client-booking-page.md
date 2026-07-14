# Task: Client Self-Booking Page — Killer Feature

**Sprint:** 5
**Scope:** both
**ID:** sprint-5/07-client-booking-page

## User story

As a moving company owner, I want a public booking page at a shareable
URL so my clients can book moves themselves, see available dates, get
an instant price estimate, and I get the order automatically in my
dashboard — without any dispatcher involvement.

## Business value

This is the killer feature differentiating MovingDesk from all
competitors in the $49-99/mo segment. No competitor offers
self-booking with real crew availability and live pricing at this
price point. Every company using MovingDesk gets their own branded
booking page — clients see it, share it, and it becomes organic growth
for the product.

---

## URL structure

```
Public booking page: https://moverflow.io/book/{slug}

Example: https://moverflow.io/book/best-movers-llc
```

`slug` comes from `tenants.slug` (already exists in DB, set on register).
No DNS changes, no subdomains — simple path routing.

---

## DB changes

### Add to tenants table

```sql
ALTER TABLE tenants ADD COLUMN booking_enabled boolean DEFAULT false;
ALTER TABLE tenants ADD COLUMN booking_description text;
```

Add to `schema.ts` and run migration.

---

## Backend

### GET /book/:slug — public page data (NO auth)

Returns tenant public info needed to render booking page:

```typescript
{
  tenant: {
    name: string
    logoUrl: string | null
    phone: string | null        // from settings
    description: string | null  // booking_description
    slug: string
    baseRates: {                // from settings.baseRates
      studio: number
      '1br': number
      '2br': number
      '3br': number
      house: number
    }
    packingFee: number
  }
}
```

If tenant not found OR booking_enabled = false → 404.
Never expose: tenantId, JWT, internal IDs, user data.

### GET /book/:slug/availability — available dates (NO auth)

Query param: `month=2026-07` (YYYY-MM)
Logic: for each day in the month, check if at least one crew has
fewer confirmed/in_progress orders than total crew count.

```typescript
// A date is AVAILABLE if:
// COUNT(orders WHERE move_date = date AND status IN ('new','confirmed','in_progress'))
// < COUNT(active crews for this tenant)

// Returns:
{
  availableDates: string[]  // ISO dates: ["2026-07-15", "2026-07-16", ...]
}
```

### POST /book/:slug — create order from booking (NO auth)

Body:

```typescript
{
  clientName: string; // required, min 2
  clientPhone: string; // required
  clientEmail: string; // optional
  fromAddress: string; // required
  toAddress: string; // required
  moveDate: string; // required, must be in availableDates
  homeSize: string; // required: studio|1br|2br|3br|house
  fromFloor: number; // default 1
  toFloor: number; // default 1
  fromElevator: boolean; // default false
  toElevator: boolean; // default false
  packing: boolean; // default false
  notes: string; // optional
}
```

Logic:

1. Validate all fields with Zod
2. Verify moveDate is still available (re-check availability)
3. Find or create client by phone (scoped to tenant)
4. Calculate price from tenant baseRates
5. INSERT order with status = 'new', created_by = null (system-created)
6. Send confirmation email to clientEmail (if provided) via Resend:
   ```
   Subject: "Your move is booked with {company name}!"
   Body: date, addresses, estimated price, company phone
   ```
7. Return: { orderId, confirmationMessage }

Race condition protection: if date becomes unavailable between
availability check and order creation → return 409
{ error: 'This date is no longer available, please choose another' }

### GET /settings — add booking fields to response

### PATCH /settings — add booking_enabled, booking_description to update

### Files to create/modify

```
backend/src/routes/book.ts           ← new public router (no auth middleware)
backend/src/services/booking.service.ts ← availability logic, order creation
backend/src/services/email.ts        ← add sendBookingConfirmation()
backend/src/db/schema.ts             ← add booking_enabled, booking_description
backend/src/app.ts                   ← register /book route BEFORE auth middleware
backend/src/routes/settings.ts       ← expose/update booking fields
```

---

## Frontend

### 1. Settings → Booking tab (new 4th tab)

Add "Booking" tab in Settings alongside Company, Team, Billing:

```
Booking page

[ ] Enable booking page
    When enabled, clients can book moves at your public link.

Your booking link:
https://moverflow.io/book/best-movers-llc  [Copy link] [Open →]

Company description (shown on booking page)
┌────────────────────────────────────────┐
│ We are a family-owned moving company  │
│ serving Orange County since 2010.     │
└────────────────────────────────────────┘
Max 300 characters.

[Save changes]
```

Toggle `Enable booking page`:

- OFF (default) → page returns 404 for clients
- ON → page is live and accessible

### 2. Public booking page /book/:slug

This is a standalone page — NO topbar, NO auth, NO MovingDesk navigation.
It's a client-facing page, not the app shell.

Layout (mobile-first, centered, max-width 560px):

```
[Company Logo or Initials Badge]
Company Name
Phone number
Short description

─────────────────────────────────

Book your move

Phone *
Name *
Email (optional)

From address *
To address *

Home size
[Studio] [1 BR] [2 BR] [3 BR] [House]

┌─────────────────────────────────┐
│ Select move date *              │
│                                 │
│  < July 2026 >                  │
│  Mo Tu We Th Fr Sa Su          │
│  ..  1  2  3  4  5  6          │  ← available dates: green/clickable
│   7  8  9 10 11 12 13          │  ← unavailable: gray/disabled
│  ...                            │
└─────────────────────────────────┘

[✓] From elevator    [✓] To elevator    [✓] Packing service

From floor [1]    To floor [1]

Notes (optional)
┌────────────────────────────────┐
│                                │
└────────────────────────────────┘

┌─────────────────────────────────┐
│ Estimated price          $480  │  ← live calculation, green
│ Base rate for 2 BR             │
└─────────────────────────────────┘

[Book my move →]
```

### Calendar component

Use a simple inline calendar (not a full FullCalendar):

- Fetch availability for current month on load
- Fetch next month when user clicks ">"
- Available dates: green background, clickable
- Unavailable/past dates: gray, disabled
- Selected date: dark background, white text

Build as a simple custom component — no external calendar library needed
for this simple use case.

### Success state

After successful submission, replace form with:

```
✅ You're booked!

{Company name} will be in touch to confirm your move.

Move date: Jun 15, 2026
From: Lake Forest, CA
To: Anaheim, CA
Estimated price: $480

Questions? Call us: (714) 555-0199
```

### Error states

- Date no longer available → inline error, calendar resets
- Phone already has booking for this date → show message
- Network error → show retry button

### 3. Orders board — mark self-booked orders

Orders created via booking page should be visually distinguishable:
Add small "🌐 Online" badge on order cards where `created_by = null`.
This tells dispatcher "this came from the website, not from a call".

### Files to create/modify

```
frontend/src/routes/BookingPage.tsx          ← new standalone page
frontend/src/components/booking/BookingCalendar.tsx  ← custom calendar
frontend/src/components/booking/BookingForm.tsx      ← form component
frontend/src/components/booking/BookingSuccess.tsx   ← success state
frontend/src/hooks/useBooking.ts             ← API hooks for public endpoints
frontend/src/routes/SettingsPage.tsx         ← add Booking tab
frontend/src/App.tsx                         ← add /book/:slug route (no auth wrapper)
frontend/src/routes/OrdersPage.tsx           ← add "Online" badge for system orders
```

---

## Acceptance criteria

### Booking page

- AC1: `/book/best-movers-llc` loads without auth, shows company branding
- AC2: `/book/nonexistent` returns 404 page
- AC3: `/book/slug` when booking_enabled=false returns 404
- AC4: Calendar shows available dates in green, unavailable in gray
- AC5: Calendar fetches next month data when navigating forward
- AC6: Live price updates when home size or packing changes
- AC7: Successful submission creates order with status 'new' in DB
- AC8: Client receives confirmation email after booking
- AC9: Race condition — if date taken between check and submit → 409 error shown
- AC10: Form is mobile-friendly at 390px width

### Settings

- AC11: Booking tab visible in Settings
- AC12: Toggle enables/disables the public page
- AC13: Booking link shown and copyable when enabled
- AC14: Description saves and appears on booking page

### Orders board

- AC15: Self-booked orders show "🌐 Online" badge on card
- AC16: created_by is null for self-booked orders (not a user UUID)

### Security

- AC17: /book routes expose NO internal IDs, tenantId, or user data
- AC18: /book routes have NO auth middleware — fully public
- AC19: Availability re-checked on submit (race condition protection)
- AC20: `npm run typecheck` passes with zero errors

---

## Out of scope

- Client cancellation or rescheduling via booking page (call company instead)
- Payment collection at booking time
- Custom domain for booking page (e.g. bestmovers.com/book)
- SMS notifications
- Booking page analytics
