# Task: Lead Pipeline

**Sprint:** 7
**Scope:** both
**ID:** sprint-7/02-lead-pipeline

## User story

As a dispatcher, I want to track potential clients before they become
orders, so no lead falls through the cracks and I can follow up
systematically.

---

## DB changes

### New table: leads

```sql
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),

  -- Contact info
  name varchar(255) NOT NULL,
  phone varchar(20),
  email varchar(255),

  -- Move details (optional at lead stage)
  from_address text,
  to_address text,
  move_date date,
  home_size varchar(20),
  notes text,

  -- Pipeline
  status varchar(20) NOT NULL DEFAULT 'new',
  -- new | contacted | quoted | booked | lost

  -- Source tracking
  source varchar(50) NOT NULL DEFAULT 'manual',
  -- manual | booking_page | zapier | phone

  -- Follow-up reminder
  reminder_sent boolean DEFAULT false,

  -- Conversion
  converted_order_id uuid REFERENCES orders(id),
  -- filled when lead → order

  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

Add to `schema.ts` and run migration.

---

## Backend

### CRUD endpoints

#### POST /leads — create lead manually

Auth: required.

```typescript
{
  name: string       // required
  phone?: string
  email?: string
  fromAddress?: string
  toAddress?: string
  moveDate?: string
  homeSize?: string
  notes?: string
  source?: 'manual' | 'phone'  // default: 'manual'
}
```

Response 201: created lead.

#### GET /leads — list leads for tenant

Auth: required.
Query params: `status?`, `search?`
Always filter by tenantId.
Returns leads ordered by created_at DESC.

#### GET /leads/:id — single lead

Auth: required. Filter by tenantId.

#### PATCH /leads/:id — update lead

Auth: required. Filter by tenantId.
Allowed fields: name, phone, email, fromAddress, toAddress,
moveDate, homeSize, notes, status.

When status changes to 'lost':

- Set updatedAt = now()
- No other action needed

#### DELETE /leads/:id — soft approach

Set status = 'lost' instead of deleting.
Never hard delete leads — keep history.

#### POST /leads/:id/convert — convert lead to order

Auth: required.
Logic:

1. Verify lead belongs to tenant
2. Find or create client by phone/email
3. Create order with lead data pre-filled:
   ```typescript
   {
     tenantId,
     clientId: client.id,
     createdBy: userId,
     status: 'new',
     fromAddress: lead.fromAddress ?? '',
     toAddress: lead.toAddress ?? '',
     moveDate: lead.moveDate ?? todayDate,
     homeSize: lead.homeSize ?? '2br',
     // other fields default
   }
   ```
4. Update lead:
   ```typescript
   { status: 'booked', convertedOrderId: order.id }
   ```
5. Return: `{ orderId: order.id }` → frontend redirects to order

### POST /leads/webhook — public Zapier endpoint

NO auth — public endpoint.
Protected by webhook secret token in query param:
`POST /leads/webhook?secret=WEBHOOK_SECRET`

Add to env.ts:

```typescript
WEBHOOK_SECRET: z.string().min(16).optional();
```

Body (flexible — accepts various field names):

```typescript
{
  name?: string
  full_name?: string
  first_name?: string
  phone?: string
  phone_number?: string
  email?: string
  email_address?: string
  from?: string
  from_address?: string
  pickup_address?: string
  to?: string
  to_address?: string
  delivery_address?: string
  move_date?: string
  date?: string
  notes?: string
  message?: string
  // tenant identification
  tenant_slug: string  // required — which company receives this lead
}
```

Logic:

1. Verify `?secret=WEBHOOK_SECRET`
2. Find tenant by `tenant_slug`
3. Normalize field names (accept various formats)
4. Create lead with `source: 'zapier'`
5. Return 200 `{ success: true, leadId }`

### Update booking page — leads instead of direct orders

Currently `POST /book/:slug` creates an order directly.
Change to create a **lead** instead:

```typescript
// routes/book.ts
// Instead of creating order directly:
const lead = await db.insert(leads).values({
  tenantId: tenant.id,
  name: body.clientName,
  phone: body.clientPhone,
  email: body.clientEmail,
  fromAddress: body.fromAddress,
  toAddress: body.toAddress,
  moveDate: body.moveDate,
  homeSize: body.homeSize,
  notes: body.notes,
  source: "booking_page",
  status: "new",
});
```

Booking page success message update:

```
✅ Request received!

Thank you, {name}. We received your moving request
and will contact you shortly to confirm.

{company name} will be in touch within 1 business day.
```

Note: this changes booking page from "auto-confirm" to "lead capture".
Dispatcher reviews lead → converts to order when ready.

### Cron job — uncontacted lead reminder

Add to `backend/src/jobs/reminder.ts`:

```typescript
export async function sendUncontactedLeadReminders(): Promise<void> {
  logger.info("Running uncontacted lead reminder job...");

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  const staleLeads = await db
    .select({
      leadId: leads.id,
      tenantId: leads.tenantId,
      name: leads.name,
      phone: leads.phone,
      source: leads.source,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, "new"),
        eq(leads.reminderSent, false),
        lt(leads.createdAt, cutoff),
      ),
    );

  for (const lead of staleLeads) {
    try {
      // Get owner email for this tenant
      const [owner] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(and(eq(users.tenantId, lead.tenantId), eq(users.role, "owner")))
        .limit(1);

      if (!owner?.email) continue;

      await sendLeadReminderEmail({
        to: owner.email,
        ownerName: owner.name,
        leadName: lead.name,
        leadPhone: lead.phone,
        leadSource: lead.source,
        createdAt: lead.createdAt,
        leadsUrl: `${env.FRONTEND_URL}/orders?tab=leads`,
      });

      await db
        .update(leads)
        .set({ reminderSent: true })
        .where(eq(leads.id, lead.leadId));
    } catch (err) {
      logger.error(
        { err, leadId: lead.leadId },
        "Failed to send lead reminder",
      );
    }
  }
}
```

Update existing cron endpoint `POST /jobs/reminders` to also run
`sendUncontactedLeadReminders()`.

### Email template — uncontacted lead reminder

```
Subject: ⚡ New lead hasn't been contacted yet — {leadName}

Hi {ownerName},

You have a lead that hasn't been contacted in over 24 hours:

Name:    {leadName}
Phone:   {leadPhone}
Source:  {leadSource}
Received: {createdAt}

Don't let this opportunity slip away!

[View leads →] {leadsUrl}

MovingDesk
```

### Files to create/modify

```
backend/src/db/schema.ts                ← add leads table
backend/src/routes/leads.ts             ← new CRUD + convert + webhook
backend/src/jobs/reminder.ts            ← add sendUncontactedLeadReminders
backend/src/lib/email.ts                ← add sendLeadReminderEmail
backend/src/lib/env.ts                  ← add WEBHOOK_SECRET
backend/src/routes/book.ts              ← create lead instead of order
backend/src/app.ts                      ← register /leads route
```

---

## Frontend

### Orders page — add Leads tab

```tsx
// Two tabs at top of Orders page:
const [tab, setTab] = useState<'kanban' | 'leads'>('kanban')

<div style={{ borderBottom: '1px solid #e0e0dc', marginBottom: 16 }}>
  <button onClick={() => setTab('kanban')}
    style={{ borderBottom: tab === 'kanban' ? '2px solid #1a1a18' : 'none' }}>
    📋 Orders
  </button>
  <button onClick={() => setTab('leads')}
    style={{ borderBottom: tab === 'leads' ? '2px solid #1a1a18' : 'none' }}>
    🎯 Leads {newLeadsCount > 0 && <span>{newLeadsCount}</span>}
  </button>
</div>

{tab === 'kanban' && <KanbanBoard />}
{tab === 'leads' && <LeadsPipeline />}
```

Show count badge on Leads tab when there are 'new' leads.

### LeadsPipeline component

Pipeline view — 4 columns:

```
New (3)    Contacted (1)    Quoted (2)    Booked (5)
────────   ─────────────   ──────────    ──────────
[card]     [card]          [card]        [card]
[card]                     [card]        [card]
[card]
```

Lost leads hidden by default. Toggle: "Show lost leads"

### Lead card

```
┌────────────────────────────────┐
│ Rick Adams          [booking_page badge]│
│ (949) 632-9557                 │
│ Jul 20 • 2BR                  │
│ Irvine → Anaheim              │
│                                │
│ [Move to next stage ▶]        │
│ [Convert to order] [Lost]     │
└────────────────────────────────┘
```

Source badge colors:

```
manual       → gray "Manual"
booking_page → blue "Online"
zapier       → purple "Zapier"
phone        → green "Phone"
```

Status progression buttons:

```
new        → [Mark as Contacted]
contacted  → [Send Quote] (just moves to quoted)
quoted     → [Book it] → actually shows Convert dialog
booked     → no action buttons (already converted)
```

### Add lead form — slide-over panel

"+ New lead" button in top-right of Leads tab.

Fields:

```
Name *
Phone
Email
From address
To address
Move date
Home size  [pills]
Source     [Manual | Phone]
Notes
[Save lead]
```

### Convert to order flow

When clicking "Convert to order" on a lead card:

```
Modal:
"Convert this lead to an order?"

Move details from lead:
• Rick Adams
• Irvine → Anaheim
• Jul 20, 2BR

These will be pre-filled in the new order.
Any missing details can be added after.

[Convert]  [Cancel]
```

On confirm:

1. POST /leads/:id/convert
2. Get back `{ orderId }`
3. Redirect to `/orders` (kanban tab)
4. Show toast "Lead converted! Order created."
5. Lead card disappears from pipeline (status = booked)

### Zapier integration info in Settings

Add to Settings → Integrations tab (new tab):

```
Zapier Integration

Connect your website forms, Facebook Lead Ads, or any
other source to automatically capture leads in MovingDesk.

Webhook URL:
https://moving-desk-production.up.railway.app/leads/webhook?secret={WEBHOOK_SECRET}

[Copy URL]

Your company slug: best-movers-llc
Include this in every request: "tenant_slug": "best-movers-llc"

Supported fields:
name, phone, email, from_address, to_address, move_date, notes

Setup guide →
```

### Files to create/modify

```
frontend/src/routes/OrdersPage.tsx          ← add Leads tab
frontend/src/components/leads/LeadsPipeline.tsx ← new
frontend/src/components/leads/LeadCard.tsx      ← new
frontend/src/components/leads/AddLeadPanel.tsx  ← new
frontend/src/components/leads/ConvertModal.tsx  ← new
frontend/src/hooks/useLeads.ts                  ← new
frontend/src/routes/SettingsPage.tsx            ← add Integrations tab
```

---

## Acceptance criteria

### Lead CRUD

- AC1: Create lead manually → appears in New column
- AC2: Move lead through stages: New → Contacted → Quoted
- AC3: Mark lead as Lost → disappears from pipeline (hidden)
- AC4: All leads filtered by tenantId

### Conversion

- AC5: "Convert to order" creates order with lead data pre-filled
- AC6: Lead status becomes 'booked' after conversion
- AC7: Converted lead shows link to the created order
- AC8: Client auto-created from lead phone/email if not exists

### Sources

- AC9: Booking page creates lead (not direct order)
- AC10: Booking page success message updated to "request received"
- AC11: Zapier webhook creates lead with source='zapier'
- AC12: Webhook rejects requests without correct secret

### Reminder

- AC13: Lead in 'new' status for 24h → owner gets reminder email
- AC14: Reminder sent only once (reminderSent = true)
- AC15: Reminder email contains link to leads page

### UI

- AC16: Leads tab shows count badge for 'new' leads
- AC17: Source badge visible on each lead card
- AC18: Pipeline columns show correct lead counts
- AC19: Lost leads hidden by default, toggleable
- AC20: `npm run typecheck` passes with zero errors

---

## Railway env vars to add

```
WEBHOOK_SECRET=<openssl rand -base64 24>
```
