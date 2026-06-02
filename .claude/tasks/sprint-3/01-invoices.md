# Task: Invoices — generate, send, share
**Sprint:** 3
**Scope:** both
**ID:** sprint-3/01-invoices

## Backend endpoints

### POST /invoices
Auth: required.
Body: { orderId }
Logic:
  1. Verify order belongs to tenant
  2. Auto-generate number: INV-1001, INV-1002...
  3. Set status='draft', expires_at=NOW()+7days
Response: 201 + invoice

### GET /invoices — list by tenant
### GET /invoices/:id — detail
### PATCH /invoices/:id/status — { status: 'sent'|'paid' }
### POST /invoices/:id/send — send PDF to client email via Resend
### GET /invoices/share/:token — PUBLIC, no auth
  Returns invoice data. 404 if expired.

## Frontend

### Invoices page
Left: list of invoices with status badges (Draft/Sent/Paid)
Right: invoice detail + actions

### Invoice detail
Rendered from order data:
  - Company logo + name
  - Invoice number + date
  - Client info
  - Move details (from/to/date/size)
  - Line items + total
  - Status badge

### Actions
  - Download PDF (@react-pdf/renderer)
  - Send to client (email)
  - Copy share link

### Public invoice page (/i/:token)
No auth. Client-facing.
Shows invoice details. "Mark as received" button.

## Acceptance criteria
- AC1: One click generates invoice from order
- AC2: PDF downloads with company logo and correct data
- AC3: Share link works without login, expires after 7 days
- AC4: Send button emails PDF to client
- AC5: Status updates: draft→sent→paid

---

## Mock mode — Frontend only (use until backend is ready)

### Mock data
```typescript
// hooks/useInvoices.ts
import type { Invoice } from '../types'

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    tenantId: 'mock-tenant-1',
    orderId: 'order-1',
    number: 'INV-1089',
    status: 'draft',
    clientName: 'Rick Adams',
    clientPhone: '(949) 632-9557',
    fromAddress: 'Lake Forest, CA',
    toAddress: 'Anaheim, CA',
    moveDate: '2026-06-15',
    homeSize: '2 BR',
    packing: false,
    basePrice: 480,
    totalPrice: 480,
    shareToken: 'mock-token-1',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'inv-2',
    tenantId: 'mock-tenant-1',
    orderId: 'order-2',
    number: 'INV-1088',
    status: 'sent',
    clientName: 'Tom Wilson',
    clientPhone: '(310) 555-0177',
    fromAddress: 'Newport Beach, CA',
    toAddress: 'Los Angeles, CA',
    moveDate: '2026-06-20',
    homeSize: 'House',
    packing: true,
    basePrice: 850,
    totalPrice: 1100,
    shareToken: 'mock-token-2',
    sentAt: '2026-06-02T11:00:00Z',
    createdAt: '2026-06-02T10:00:00Z',
  },
  {
    id: 'inv-3',
    tenantId: 'mock-tenant-1',
    orderId: 'order-4',
    number: 'INV-1087',
    status: 'paid',
    clientName: 'James Lee',
    clientPhone: '(714) 555-0142',
    fromAddress: 'Tustin, CA',
    toAddress: 'Yorba Linda, CA',
    moveDate: '2026-06-10',
    homeSize: '2 BR',
    packing: false,
    basePrice: 480,
    totalPrice: 480,
    shareToken: 'mock-token-3',
    sentAt: '2026-06-10T15:00:00Z',
    paidAt: '2026-06-11T09:00:00Z',
    createdAt: '2026-06-10T14:00:00Z',
  },
]

const MOCK_COMPANY = {
  name: 'Best & Pro Moving Service',
  phone: '(714) 555-0199',
  website: 'bestpro-moving.com',
  logoUrl: null,
}
```

### Mock hooks
```typescript
export const useInvoices = () => useQuery({
  queryKey: ['invoices'],
  queryFn: async () => {
    await new Promise(r => setTimeout(r, 300))
    return MOCK_INVOICES
  }
})

export const useGenerateInvoice = () => useMutation({
  mutationFn: async (orderId: string) => {
    await new Promise(r => setTimeout(r, 800))
    // find matching mock order and create invoice
    return MOCK_INVOICES[0]
  }
})

export const useUpdateInvoiceStatus = () => useMutation({
  mutationFn: async ({ id, status }: { id: string; status: string }) => {
    await new Promise(r => setTimeout(r, 300))
    const inv = MOCK_INVOICES.find(i => i.id === id)
    if (inv) inv.status = status
    return inv
  }
})

// Public share page — no auth
export const usePublicInvoice = (token: string) => useQuery({
  queryKey: ['invoice-public', token],
  queryFn: async () => {
    await new Promise(r => setTimeout(r, 400))
    return { invoice: MOCK_INVOICES[0], company: MOCK_COMPANY }
  }
})
```

### PDF generation — works fully without backend
@react-pdf/renderer runs entirely in browser.
Use MOCK_INVOICES data + MOCK_COMPANY for PDF content.
PDF generation does NOT need backend to work.

### Sync checklist (when backend is ready)
- [ ] Replace useInvoices queryFn with GET /invoices
- [ ] Replace useGenerateInvoice with POST /invoices
- [ ] Replace useUpdateInvoiceStatus with PATCH /invoices/:id/status
- [ ] Replace usePublicInvoice with GET /invoices/share/:token
- [ ] Replace MOCK_COMPANY with GET /settings response
- [ ] Wire "Send to client" button to POST /invoices/:id/send
