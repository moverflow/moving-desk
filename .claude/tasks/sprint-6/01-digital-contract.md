# Task: Digital Contract + E-Signature

**Sprint:** 6
**Scope:** both
**ID:** sprint-6/01-digital-contract

## User story

As a moving company owner, I want contracts automatically generated
when an order is confirmed, so clients can sign digitally and I have
legal protection without any manual paperwork.

---

## DB changes

### Add to orders table

```sql
ALTER TABLE orders ADD COLUMN contract_status varchar(20) DEFAULT 'none';
-- values: none | sent | signed
ALTER TABLE orders ADD COLUMN contract_token uuid UNIQUE DEFAULT NULL;
ALTER TABLE orders ADD COLUMN contract_signed_at timestamp DEFAULT NULL;
ALTER TABLE orders ADD COLUMN contract_signed_name varchar(255) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN contract_signature_url text DEFAULT NULL;
-- URL to signature image stored in R2
```

### Add to tenants.settings JSONB

```typescript
type TenantSettings = {
  // existing fields...
  contractTerms?: string; // custom terms text, max 2000 chars
};
```

Add to `schema.ts` and run migration.

---

## Backend

### Auto-generate contract when order → confirmed

In `orders.service.ts`, in the `updateOrderStatus` function:
When status changes to `'confirmed'`:

1. Generate `contract_token` = new UUID
2. Set `contract_status` = `'sent'`
3. Send contract link email to client (if client has email)
4. Save token to order

```typescript
// In updateOrderStatus() — add after status update:
if (newStatus === "confirmed" && order.clientId) {
  const client = await getClientById(order.clientId, tenantId);
  if (client?.email) {
    const token = crypto.randomUUID();
    await db
      .update(orders)
      .set({ contractToken: token, contractStatus: "sent" })
      .where(eq(orders.id, orderId));

    await sendContractEmail({
      to: client.email,
      clientName: client.name,
      companyName: tenant.name,
      moveDate: order.moveDate,
      contractUrl: `${env.FRONTEND_URL}/contract/${token}`,
    });
  }
}
```

### GET /contract/:token — public, NO auth

Returns contract data needed to render signing page:

```typescript
{
  order: {
    moveDate: string        // "Jun 15, 2026"
    fromAddress: string
    toAddress: string
    homeSize: string        // "2 BR"
    packing: boolean
    totalPrice: number
    fromFloor: number
    toFloor: number
    fromElevator: boolean
    toElevator: boolean
  },
  client: {
    name: string
    phone: string
  },
  company: {
    name: string
    logoUrl: string | null
    phone: string | null
    contractTerms: string | null  // custom terms from settings
  },
  contractStatus: 'sent' | 'signed',
  alreadySigned: boolean
}
```

If token not found → 404
If already signed → return data with `alreadySigned: true`
Never expose: tenantId, internal IDs, JWT

### POST /contract/:token/sign — public, NO auth

Body:

```typescript
{
  signedName: string; // required, min 2 chars
  signatureDataUrl: string; // required, base64 PNG from canvas
}
```

Logic:

1. Find order by token, verify not already signed
2. Upload signature image to R2:
   `signatures/{orderId}/signature.png`
3. Update order:
   ```typescript
   {
     contractStatus: 'signed',
     contractSignedAt: new Date(),
     contractSignedName: signedName,
     contractSignatureUrl: r2Url,
   }
   ```
4. Generate signed contract PDF and store in order_files:
   - Use same PDF library as invoices (@react-pdf/renderer on server
     OR generate on frontend and POST the PDF blob)
   - Filename: `contract-signed-{orderNumber}.pdf`
   - Store in R2: `contracts/{tenantId}/{orderId}/signed-contract.pdf`
   - Insert into order_files table
5. Send notification email to dispatcher/owner:
   ```
   Subject: "✅ {clientName} signed the contract for {moveDate} move"
   Body: client name, move date, link to order in MovingDesk
   ```
6. Return: `{ success: true, message: 'Contract signed successfully' }`

### GET /orders/:id — extend response

Add contract fields to existing order detail response:

```typescript
{
  // existing fields...
  contractStatus: 'none' | 'sent' | 'signed',
  contractSignedAt: string | null,
  contractSignedName: string | null,
}
```

### PATCH /settings — add contractTerms field

Already exists, just ensure contractTerms is accepted and saved.

### Email templates — add to email.ts

```typescript
export async function sendContractEmail(params: {
  to: string;
  clientName: string;
  companyName: string;
  moveDate: string;
  contractUrl: string;
}): Promise<void>;

export async function sendContractSignedNotification(params: {
  to: string; // owner/dispatcher email
  clientName: string;
  moveDate: string;
  orderUrl: string;
}): Promise<void>;
```

### Files to create/modify

```
backend/src/db/schema.ts                ← add contract fields to orders
backend/src/routes/contract.ts          ← new public router
backend/src/routes/orders.ts            ← trigger contract on confirmed
backend/src/services/orders.service.ts  ← updateOrderStatus() + contract logic
backend/src/services/contract.service.ts ← new: generateContract, signContract
backend/src/lib/email.ts               ← add sendContractEmail, sendContractSignedNotification
backend/src/app.ts                      ← register /contract route BEFORE auth middleware
backend/src/routes/settings.ts         ← ensure contractTerms field supported
```

---

## Frontend

### 1. Contract signing page — /contract/:token

Standalone page — NO AppShell, NO auth, NO MovingDesk navigation.
Same pattern as booking page — client-facing only.

Layout (mobile-first, max-width 600px, centered):

```
[Company Logo or Initials]
Company Name

Moving Service Agreement
────────────────────────────────

MOVE DETAILS
From:     Lake Forest, CA 92630
To:       Anaheim, CA 92801
Date:     Jun 15, 2026
Size:     2 BR
Packing:  Yes
Price:    $600

STANDARD TERMS
1. The company is not responsible for items not properly packed.
2. Payment is due upon completion of the move.
3. Cancellations within 48 hours may incur a fee.
4. The company carries standard liability insurance.

COMPANY TERMS
[custom terms from settings.contractTerms — or hidden if empty]

────────────────────────────────
CLIENT SIGNATURE

Full name *
[text input]

Signature *
┌──────────────────────────────────┐
│                                  │
│    [Sign here with mouse/touch]  │
│                                  │
└──────────────────────────────────┘
[Clear signature]

By signing, I agree to all terms above.

[Sign Contract →]
```

### Already signed state

If `alreadySigned: true`, show:

```
✅ Contract already signed

This contract was signed by {signedName}
on {signedDate}.

Thank you!
```

### Success state after signing

```
✅ Contract signed successfully!

Thank you, {name}. Your moving contract has been signed.

Move date: Jun 15, 2026
{Company name} will be in touch with any updates.

Questions? Call: {company phone}
```

### Signature canvas component

Use `react-signature-canvas` library:

```bash
npm install react-signature-canvas
npm install --save-dev @types/react-signature-canvas
```

```tsx
import SignatureCanvas from "react-signature-canvas";

const sigCanvas = useRef<SignatureCanvas>(null);

// Get signature as PNG:
const dataUrl = sigCanvas.current?.toDataURL("image/png");

// Clear:
sigCanvas.current?.clear();
```

Canvas styling:

```css
border: 1px solid #ccc
border-radius: 8px
width: 100%
height: 160px
touch-action: none  /* important for mobile */
background: white
```

### 2. Order detail — contract status indicator

In order slide-over / detail view, add contract section:

```
Contract
──────────────
● None      → [Send contract] button (manual resend)
● Sent      → "Waiting for signature" + [Resend] button
● Signed    → "Signed by {name} on {date}" (green)
              [View signed contract] → opens R2 PDF URL
```

"Send contract" button: available when order is confirmed but
contractStatus is 'none' (e.g. client had no email at booking time).
POST /orders/:id/send-contract

### 3. Settings → Company tab — add contract terms field

Below existing company fields:

```
Contract terms (optional)
┌────────────────────────────────────────┐
│ Enter your custom terms and conditions │
│ that will appear in every contract...  │
└────────────────────────────────────────┘
Max 2000 characters. Leave empty to use standard terms only.
```

### Files to create/modify

```
frontend/src/routes/ContractPage.tsx          ← new standalone page
frontend/src/components/contract/Signaturepad.tsx ← canvas component
frontend/src/components/contract/ContractContent.tsx ← contract display
frontend/src/hooks/useContract.ts             ← API hooks
frontend/src/routes/SettingsPage.tsx          ← add contractTerms field
frontend/src/routes/OrdersPage.tsx            ← add contract status to order detail
frontend/src/App.tsx                          ← add /contract/:token route (no auth)
package.json                                  ← add react-signature-canvas
```

---

## Standard contract terms (hardcoded in template)

```
1. LIABILITY: The company's liability is limited to $0.60 per pound per
   article as per standard moving industry regulations.

2. PAYMENT: Full payment is due upon completion of the move unless
   otherwise agreed in writing.

3. CANCELLATION: Cancellations made less than 48 hours before the
   scheduled move date may be subject to a cancellation fee.

4. DELAYS: The company is not liable for delays caused by traffic,
   weather, or other circumstances beyond its control.

5. FRAGILE ITEMS: The company is not responsible for damage to items
   that were not packed by company personnel.

6. ACCESS: Client is responsible for ensuring adequate access to both
   pickup and delivery locations.
```

---

## Acceptance criteria

### Contract generation

- AC1: Order confirmed → contract_token generated, email sent to client
- AC2: No client email → contract_token generated, no email (no crash)
- AC3: Contract email contains correct /contract/:token URL
- AC4: GET /contract/:token returns order + company data, no internal IDs

### Signing

- AC5: Client can draw signature on canvas (desktop + mobile touch)
- AC6: Clear button resets canvas
- AC7: Full name required — empty name shows validation error
- AC8: Empty canvas → shows error "Please provide your signature"
- AC9: Successful sign → order contract_status = 'signed'
- AC10: Signature image uploaded to R2
- AC11: Signed contract PDF created and stored in order_files
- AC12: Dispatcher/owner receives email notification after signing
- AC13: Already signed contract shows "already signed" message, not form

### Order detail

- AC14: Contract status visible in order detail (None/Sent/Signed)
- AC15: "View signed contract" opens PDF for signed contracts
- AC16: Manual "Send contract" button works for confirmed orders without email

### Settings

- AC17: Contract terms field saves and appears in contracts

### Security

- AC18: /contract routes have NO auth middleware — fully public
- AC19: Contract data exposes NO tenantId, userId, or internal IDs
- AC20: Token is UUID — not guessable/sequential

### Design

- AC21: Contract page mobile-friendly at 390px
- AC22: Signature canvas works on touch devices
- AC23: `npm run typecheck` passes with zero errors
