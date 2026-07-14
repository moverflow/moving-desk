# Task: Seed script — 3 months of realistic order data

**Sprint:** dev-tools
**Scope:** backend
**ID:** dev-tools/01-seed-data

## Purpose

Create a seed script that generates 3 months of realistic order data
for testing AI analytics. The script must be idempotent (safe to run
multiple times without duplicating data).

## Target tenant

```
TENANT_ID: 33b29222-392a-408b-a0c3-115336acd98f
```

## What to generate

### Clients (12 unique clients)

```typescript
const CLIENT_DATA = [
  { name: "Rick Adams", phone: "(949) 632-9557", email: "radams@email.com" },
  { name: "Maria Chen", phone: "(714) 555-0142", email: "mchen@email.com" },
  { name: "Tom Wilson", phone: "(310) 555-0177", email: "twilson@email.com" },
  { name: "Sarah Park", phone: "(657) 555-0201", email: "spark@email.com" },
  { name: "James Lee", phone: "(949) 555-0188", email: "jlee@email.com" },
  { name: "Anna Brooks", phone: "(562) 555-0234", email: "abrooks@email.com" },
  {
    name: "David Martinez",
    phone: "(213) 555-0156",
    email: "dmartinez@email.com",
  },
  {
    name: "Emily Johnson",
    phone: "(818) 555-0189",
    email: "ejohnson@email.com",
  },
  { name: "Michael Brown", phone: "(626) 555-0145", email: "mbrown@email.com" },
  {
    name: "Jessica Taylor",
    phone: "(323) 555-0167",
    email: "jtaylor@email.com",
  },
  { name: "Robert Davis", phone: "(714) 555-0198", email: "rdavis@email.com" },
  { name: "Linda Wilson", phone: "(949) 555-0211", email: "lwilson@email.com" },
];
```

Check if client with same phone already exists for this tenant before inserting.

### Crews

Check if crews exist for tenant. If none — create 2:

```
Team A — Truck #3
Team B — Truck #7
```

### Orders — 3 months, ~40 orders total

**Date distribution (realistic):**

- Start: 90 days ago from script run date
- End: today
- Weekdays: 70% chance of order on that day
- Weekends: 40% chance
- Max 2 orders per day (limited by 2 crews)
- ~15% cancellation rate

**Order data per record:**

```typescript
homeSize: random from ['studio','1br','2br','2br','3br','3br','house']
          // 2br and 3br weighted heavier — most common
basePrice: from BASE_RATES map
           { studio:280, '1br':380, '2br':480, '3br':620, house:850 }
packing:   25% chance = true → adds $120 to total
totalPrice: basePrice + (packing ? 120 : 0)
fromAddress/toAddress: random from 10 realistic CA address pairs
clientId:  random from seeded clients
crewId:    random from tenant crews
createdBy: first owner user found for this tenant
createdAt: move_date minus random 1-14 days (booked in advance)
```

**Status logic based on how long ago the move was:**

```typescript
const daysAgo = daysBetween(today, moveDate)

if (isCancelled):           status = 'cancelled'
else if (daysAgo > 7):      status = 'completed' (90%) or 'closed' (10%)
else if (daysAgo > 0):      status = 'completed' (70%) or 'in_progress' (30%)
else (today or future):     status = 'confirmed' (50%) or 'new' (50%)
```

**Repeat clients:**

- 3 clients should have 2-3 orders each (for retention analysis)
- Assign Rick Adams, Maria Chen, James Lee at least 2 orders each

### Invoices

For every completed/closed order, create invoice:

```typescript
number: 'INV-' + (1000 + index)
status:
  - 80% chance 'sent' or 'paid'
  - of those sent: 75% chance 'paid'
  - rest: 'draft'
sentAt:  moveDate + 1 day (if sent/paid)
paidAt:  moveDate + random(2,10) days (if paid)
```

## Script setup

### File location

```
backend/scripts/seed-analytics.ts
```

### Run command — add to package.json

```json
"seed": "tsx scripts/seed-analytics.ts"
```

### Idempotent behavior

Before inserting any client — check by phone + tenantId.
Before running — print count of existing orders for this tenant.
If orders > 20 already exist → ask confirmation or add --force flag.

### Output

```
🌱 Starting seed for tenant: 33b29222-...
📋 Found 2 existing crews
👥 12 clients ready (8 created, 4 already existed)
📦 Generating 42 orders across 90 days...
  Progress: 10/42...
  Progress: 20/42...
  Progress: 30/42...
  Progress: 42/42...
✅ Seed complete!
   Orders created: 42
   Cancelled: 6 (14%)
   Invoices created: 31
   Clients: 12 (3 with repeat orders)
   Date range: Apr 15 — Jul 13, 2026
🎉 Ready to test AI analytics!
```

## CA addresses to use

```typescript
const ADDRESSES = [
  {
    from: "123 Oak St, Irvine, CA 92602",
    to: "456 Pine Ave, Anaheim, CA 92801",
  },
  {
    from: "789 Elm St, Newport Beach, CA 92660",
    to: "321 Oak Ave, Los Angeles, CA 90001",
  },
  {
    from: "555 Main St, Fullerton, CA 92831",
    to: "777 Park Rd, Brea, CA 92821",
  },
  {
    from: "100 First St, Tustin, CA 92780",
    to: "200 Second St, Yorba Linda, CA 92886",
  },
  {
    from: "300 Lake Dr, Irvine, CA 92612",
    to: "400 Ocean Blvd, Huntington Beach, CA 92648",
  },
  {
    from: "500 Hill Rd, Costa Mesa, CA 92626",
    to: "600 Valley St, Santa Ana, CA 92701",
  },
  {
    from: "700 Beach Blvd, Huntington Beach, CA 92647",
    to: "800 Surf Ave, Newport Beach, CA 92663",
  },
  {
    from: "900 Park St, Anaheim, CA 92805",
    to: "100 Garden Rd, Orange, CA 92868",
  },
  {
    from: "200 River Rd, Irvine, CA 92618",
    to: "300 Lake St, Mission Viejo, CA 92692",
  },
  {
    from: "400 Forest Ave, Laguna Hills, CA 92653",
    to: "500 Canyon Rd, Aliso Viejo, CA 92656",
  },
];
```

## Acceptance criteria

- AC1: Script runs without errors: `npm run seed`
- AC2: ~40 orders created for target tenant
- AC3: ~15% orders have status 'cancelled'
- AC4: ~80% of completed orders have invoices
- AC5: 3 clients have 2+ orders (for retention analysis)
- AC6: Running script twice does NOT duplicate clients
- AC7: All orders have valid tenant_id, client_id, crew_id, created_by
- AC8: createdAt is before move_date on every order
- AC9: `npm run typecheck` passes
