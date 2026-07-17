# Task: Stripe Payment Links — online payment in invoice

**Sprint:** 6
**Scope:** both
**ID:** sprint-6/02-stripe-payment-links

## User story

As a client, I want to pay my moving invoice online directly from
the invoice page, so I don't need to call or send cash.

As an owner, I want payment status to update automatically when
client pays, so I don't need to manually track payments.

---

## DB changes

### Add to invoices table

```sql
ALTER TABLE invoices ADD COLUMN stripe_payment_intent_id varchar(255);
ALTER TABLE invoices ADD COLUMN stripe_checkout_session_id varchar(255);
ALTER TABLE invoices ADD COLUMN paid_amount integer; -- in dollars
```

Add to `schema.ts` and run migration.

---

## Backend

### POST /invoices/:id/payment-link — create Stripe checkout session

Auth: required (dispatcher or owner).
Verify invoice belongs to tenant.

Logic:

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Moving service — ${order.homeSize.toUpperCase()}`,
          description: `${order.fromAddress} → ${order.toAddress}, ${formatDate(order.moveDate)}`,
        },
        unit_amount: invoice.totalPrice * 100, // convert to cents
      },
      quantity: 1,
    },
  ],
  mode: "payment",
  success_url: `${env.FRONTEND_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${env.FRONTEND_URL}/i/${invoice.shareToken}`,
  metadata: {
    invoiceId: invoice.id,
    tenantId: invoice.tenantId,
    orderId: invoice.orderId,
  },
  customer_email: client.email ?? undefined,
});

// Save session ID to invoice
await db
  .update(invoices)
  .set({ stripeCheckoutSessionId: session.id })
  .where(eq(invoices.id, invoiceId));

return { checkoutUrl: session.url };
```

Only create session if invoice.status === 'sent'.
Return 422 if status is 'draft' or 'paid'.

### GET /invoices/share/:token — extend response

Add payment fields:

```typescript
{
  // existing fields...
  paymentUrl: string | null,      // Stripe checkout URL if session exists
  stripeSessionId: string | null,
}
```

If invoice.status === 'sent' AND stripeCheckoutSessionId exists →
return the checkout URL.

If invoice.status === 'sent' AND no session yet →
frontend will call POST /invoices/:id/payment-link to create one.

### POST /billing/webhook — handle payment success

Already exists. Add handler for new event:

```
checkout.session.completed
```

Add this event to Stripe webhook in Dashboard (edit existing webhook).

Handler logic:

```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session

  if (session.payment_status !== 'paid') break

  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) break

  // Update invoice status
  await db.update(invoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paidAmount: session.amount_total ? session.amount_total / 100 : null,
      stripePaymentIntentId: session.payment_intent as string,
    })
    .where(eq(invoices.id, invoiceId))

  // Send payment confirmation email to client
  const invoice = await getInvoiceById(invoiceId)
  const client = await getClientById(invoice.order.clientId, invoice.tenantId)

  if (client?.email) {
    await sendPaymentConfirmationEmail({
      to: client.email,
      clientName: client.name,
      companyName: tenant.name,
      amount: session.amount_total! / 100,
      moveDate: invoice.order.moveDate,
      invoiceNumber: invoice.number,
    })
  }
  break
}
```

### Add email function

```typescript
// lib/email.ts
export async function sendPaymentConfirmationEmail(params: {
  to: string;
  clientName: string;
  companyName: string;
  amount: number;
  moveDate: string;
  invoiceNumber: string;
}): Promise<void> {
  await resend.emails
    .send({
      from: env.EMAIL_FROM ?? "MovingDesk <onboarding@resend.dev>",
      to: params.to,
      subject: `Payment received — ${params.invoiceNumber}`,
      text: `Hi ${params.clientName},\n\nWe received your payment of $${params.amount} for your move on ${params.moveDate}.\n\nThank you!\n${params.companyName}`,
    })
    .catch((err) =>
      logger.error({ err }, "Failed to send payment confirmation email"),
    );
}
```

### Add to Stripe webhook events

In Stripe Dashboard → Webhooks → Edit destination → add:

```
checkout.session.completed
```

### Files to modify

```
backend/src/db/schema.ts              ← add stripe fields to invoices
backend/src/routes/invoices.ts        ← add POST /invoices/:id/payment-link
backend/src/routes/billing.ts         ← handle checkout.session.completed
backend/src/services/invoices.service.ts ← getInvoiceWithOrder()
backend/src/lib/email.ts              ← add sendPaymentConfirmationEmail
```

---

## Frontend

### Public invoice page (/i/:token) — add Pay Now button

Current page shows invoice details + Download PDF + Send to client + status.

Add payment section when `invoice.status === 'sent'`:

```
┌─────────────────────────────────────────────┐
│  Total due: $480                            │
│                                             │
│  [💳 Pay now — $480]                        │
│                                             │
│  Secure payment powered by Stripe           │
└─────────────────────────────────────────────┘
```

Button behavior:

1. Click → call POST /invoices/:id/payment-link (need invoice id)
   Problem: public page uses share token, not invoice id.
   Solution: GET /invoices/share/:token returns invoice id in response
   (add `id` field to public invoice response — not tenantId, just invoice UUID)

2. Get `checkoutUrl` from response
3. `window.location.href = checkoutUrl` → redirect to Stripe Checkout

Loading state: show spinner on button while creating session.

When `invoice.status === 'paid'`:

```
┌─────────────────────────────────────────────┐
│  ✅ Payment received                        │
│  Paid on Jun 15, 2026                       │
└─────────────────────────────────────────────┘
```

### Payment success page (/pay/success)

New standalone page — no auth, no AppShell.
URL: `/pay/success?session_id=cs_xxx`

```
[Company logo or initials]
Company Name

✅ Payment successful!

Thank you for your payment.
A confirmation has been sent to your email.

[Close this page]
```

No need to fetch session details — just show success message.
The webhook handles the actual status update.

### Files to create/modify

```
frontend/src/routes/PublicInvoicePage.tsx   ← add Pay Now button
frontend/src/routes/PaySuccessPage.tsx      ← new standalone page
frontend/src/hooks/usePublicInvoice.ts      ← update to include id field
frontend/src/App.tsx                        ← add /pay/success route (no auth)
```

---

## Test card numbers (Stripe test mode)

For testing payments use these card numbers:

```
Success:  4242 4242 4242 4242  (any future expiry, any CVC)
Decline:  4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

---

## Acceptance criteria

### Payment flow

- AC1: "Pay now" button visible on public invoice when status = 'sent'
- AC2: Button click creates Stripe Checkout session and redirects client
- AC3: After successful payment → redirect to /pay/success page
- AC4: Stripe webhook updates invoice status to 'paid' automatically
- AC5: paidAt timestamp saved on invoice
- AC6: Client receives payment confirmation email
- AC7: Public invoice page shows "Payment received" when status = 'paid'

### Edge cases

- AC8: "Pay now" NOT shown when status = 'draft'
- AC9: "Pay now" NOT shown when status = 'paid'
- AC10: If session creation fails → show error toast, button re-enabled
- AC11: Double-click protection — button disabled while loading

### Webhook

- AC12: checkout.session.completed event handled correctly
- AC13: Webhook signature verified (STRIPE_WEBHOOK_SECRET)
- AC14: Idempotent — processing same webhook twice doesn't double-update

### Security

- AC15: Payment link only created for invoices belonging to correct tenant
- AC16: Public invoice response includes invoice UUID but NOT tenantId
- AC17: `npm run typecheck` passes with zero errors

---

## Note on Stripe webhook

After adding `checkout.session.completed` to Railway env and Stripe webhook,
test with Stripe test card: 4242 4242 4242 4242
Check Railway logs for webhook receipt confirmation.
