# Task: Automated Email Notifications

**Sprint:** 6
**Scope:** backend
**ID:** sprint-6/03-auto-notifications

## User story

As a client, I want to receive automatic email reminders before my
move and confirmation when it's complete, so I feel informed without
calling the company.

As an owner, I want these emails to go out automatically without any
dispatcher action, so my business looks professional with zero effort.

---

## Two notification triggers

### Trigger 1 — Move completed email

When order status changes to `completed`:

- Send email to client (if has email)
- Includes: thank you, invoice link, review request text

### Trigger 2 — 24h reminder (cron job)

Every day at 8:00 AM UTC:

- Find all orders with move_date = tomorrow AND status = 'confirmed'
- Send reminder email to each client (if has email)
- Never send twice (track with sent flag)

---

## DB changes

### Add to orders table

```sql
ALTER TABLE orders ADD COLUMN reminder_sent boolean DEFAULT false;
-- prevents duplicate reminder emails
```

Add to `schema.ts` and run migration.

---

## Backend

### Trigger 1 — order completed email

In `orders.service.ts`, in `updateOrderStatus()`:
When status changes to `'completed'`:

```typescript
if (newStatus === "completed" && order.clientId) {
  const client = await getClientById(order.clientId, tenantId);
  const invoice = await getInvoiceByOrderId(order.id, tenantId);
  const tenant = await getTenantById(tenantId);

  if (client?.email) {
    await sendMoveCompletedEmail({
      to: client.email,
      clientName: client.name,
      companyName: tenant.name,
      companyPhone: tenant.settings?.phone ?? null,
      moveDate: order.moveDate,
      invoiceUrl: invoice
        ? `${env.FRONTEND_URL}/i/${invoice.shareToken}`
        : null,
    });
  }
}
```

### Email template — move completed

```
Subject: Your move is complete — thank you!

Hi {clientName},

Your move on {moveDate} has been completed successfully.
Thank you for choosing {companyName}!

{if invoiceUrl}
Your invoice is ready:
{invoiceUrl}
{endif}

We'd love to hear about your experience — feel free to leave us
a review. It means a lot to our small business.

If you have any questions, call us: {companyPhone}

Best regards,
{companyName}
```

### Trigger 2 — 24h reminder cron job

#### New file: backend/src/jobs/reminder.ts

```typescript
import { db } from "../db/index.js";
import { orders, clients, tenants } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { sendMoveReminderEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

export async function sendDailyReminders(): Promise<void> {
  logger.info("Running daily reminder job...");

  // Get tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  // Find all confirmed orders for tomorrow that haven't been reminded
  const ordersToRemind = await db
    .select({
      orderId: orders.id,
      tenantId: orders.tenantId,
      moveDate: orders.moveDate,
      fromAddress: orders.fromAddress,
      toAddress: orders.toAddress,
      clientId: orders.clientId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.moveDate, tomorrowDate),
        eq(orders.status, "confirmed"),
        eq(orders.reminderSent, false),
      ),
    );

  logger.info(`Found ${ordersToRemind.length} orders to remind`);

  for (const order of ordersToRemind) {
    try {
      if (!order.clientId) continue;

      const [client] = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, order.clientId),
            eq(clients.tenantId, order.tenantId),
          ),
        )
        .limit(1);

      if (!client?.email) continue;

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, order.tenantId))
        .limit(1);

      await sendMoveReminderEmail({
        to: client.email,
        clientName: client.name,
        companyName: tenant.name,
        companyPhone: (tenant.settings as any)?.phone ?? null,
        moveDate: order.moveDate,
        fromAddress: order.fromAddress,
        toAddress: order.toAddress,
      });

      // Mark as reminded to prevent duplicate sends
      await db
        .update(orders)
        .set({ reminderSent: true })
        .where(eq(orders.id, order.orderId));

      logger.info(
        { orderId: order.orderId, clientEmail: client.email },
        "Reminder sent successfully",
      );
    } catch (err) {
      logger.error(
        { err, orderId: order.orderId },
        "Failed to send reminder for order",
      );
      // Continue with next order — don't stop the whole job
    }
  }

  logger.info("Daily reminder job complete");
}
```

#### Cron endpoint: POST /jobs/reminders

New route that triggers the reminder job.
Protected with a secret token (not user auth — cron service auth):

```typescript
// routes/jobs.ts
app.post("/jobs/reminders", async (c) => {
  const secret = c.req.header("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Run async, don't wait
  sendDailyReminders().catch((err) =>
    logger.error({ err }, "Reminder job failed"),
  );

  return c.json({ message: "Reminder job started" });
});
```

#### Add to env.ts

```typescript
CRON_SECRET: z.string().min(16),
```

#### Add to Railway Variables

```
CRON_SECRET=<generate with: openssl rand -base64 24>
```

### Railway Cron Service setup

In Railway project, add a new service:

- Service type: Cron
- Schedule: `0 8 * * *` (every day at 8:00 AM UTC)
- Command:

```bash
curl -X POST \
  https://moving-desk-production.up.railway.app/jobs/reminders \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Set `CRON_SECRET` env var in the cron service too.

Note: Railway cron services are available on Hobby plan and above.
If not available, use cron-job.org (free) with the same curl command.

### Email templates — add to email.ts

```typescript
export async function sendMoveCompletedEmail(params: {
  to: string;
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  moveDate: string;
  invoiceUrl: string | null;
}): Promise<void>;

export async function sendMoveReminderEmail(params: {
  to: string;
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  moveDate: string;
  fromAddress: string;
  toAddress: string;
}): Promise<void>;
```

#### Move reminder email template

```
Subject: Reminder: Your move is tomorrow!

Hi {clientName},

Just a reminder that your move is scheduled for tomorrow, {moveDate}.

Move details:
From: {fromAddress}
To:   {toAddress}

Please make sure everything is packed and ready.
If you need to make any changes, call us: {companyPhone}

See you tomorrow!
{companyName}
```

#### Move completed email template

```
Subject: Your move is complete — thank you!

Hi {clientName},

Your move on {moveDate} has been completed successfully.
Thank you for choosing {companyName}!

{if invoiceUrl}
Your invoice is ready for payment:
{invoiceUrl}
{endif}

We'd love to hear about your experience — feel free to leave us
a review. It means a lot to our small business.

{if companyPhone}
Questions? Call us: {companyPhone}
{endif}

Best regards,
{companyName}
```

### Files to create/modify

```
backend/src/db/schema.ts              ← add reminder_sent to orders
backend/src/jobs/reminder.ts          ← new cron job logic
backend/src/routes/jobs.ts            ← new POST /jobs/reminders endpoint
backend/src/routes/orders.ts          ← trigger completed email on status change
backend/src/services/orders.service.ts ← updateOrderStatus() additions
backend/src/lib/email.ts              ← add sendMoveCompletedEmail, sendMoveReminderEmail
backend/src/lib/env.ts                ← add CRON_SECRET
backend/src/app.ts                    ← register /jobs route
```

---

## Testing

### Test Trigger 1 (completed email)

1. Create order with client email = bestmover.flow@gmail.com
2. Move status to confirmed → in_progress → completed
3. Check email — should receive "Your move is complete" email

### Test Trigger 2 (24h reminder)

1. Create order with move_date = tomorrow, status = confirmed
2. Call endpoint manually:

```bash
curl -X POST \
  https://moving-desk-production.up.railway.app/jobs/reminders \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

3. Check email — should receive reminder
4. Call again — should NOT send duplicate (reminder_sent = true)

---

## Acceptance criteria

### Completed email (Trigger 1)

- AC1: Status → completed triggers email to client
- AC2: Email contains invoice link when invoice exists
- AC3: Email contains review request text
- AC4: No crash if client has no email
- AC5: No crash if no invoice exists for order

### Reminder email (Trigger 2)

- AC6: POST /jobs/reminders without secret → 401
- AC7: POST /jobs/reminders with wrong secret → 401
- AC8: POST /jobs/reminders with correct secret → 200, job starts
- AC9: Orders with move_date = tomorrow AND status = confirmed get reminder
- AC10: Orders already reminded (reminder_sent = true) skipped
- AC11: reminder_sent = true after successful send
- AC12: One failing email doesn't stop other reminders in same run
- AC13: Orders with status ≠ confirmed skipped (cancelled, completed etc)

### General

- AC14: EMAIL_FROM env var used as sender (not hardcoded)
- AC15: All DB queries filter by tenantId where applicable
- AC16: `npm run typecheck` passes with zero errors
