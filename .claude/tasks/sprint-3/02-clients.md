# Task: Clients — list, detail, history
**Sprint:** 3
**Scope:** both
**ID:** sprint-3/02-clients

## Backend endpoints

### GET /clients
Auth: required. Filter by tenant_id.
Query: search? (name or phone)
Response: clients with order_count

### GET /clients/:id
Detail + full order history

### PATCH /clients/:id
Update: name, email, notes only.
Phone is immutable (it's the lookup key).

## Frontend

### Clients page
Search bar (by name or phone).
Table: Name | Phone | Last move | Orders count | Actions
"New order" button on each row → pre-fills form with client data.

### Client detail (slide-over)
Contact info + notes (editable).
Order history list.
"New order" button.

## Acceptance criteria
- AC1: Search by phone returns correct client
- AC2: New order from client page pre-fills all known fields
- AC3: Order history shows all past orders
- AC4: Notes saved on blur (auto-save)

---

## Mock mode (use until backend is ready)

### Mock data
```typescript
// hooks/useClients.ts
import type { Client } from '../types'

const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-1',
    tenantId: 'mock-tenant-1',
    name: 'Rick Adams',
    phone: '(949) 632-9557',
    email: 'radams@example.com',
    notes: 'Prefers morning moves',
    orderCount: 1,
    lastMoveDate: '2026-06-15',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'client-2',
    tenantId: 'mock-tenant-1',
    name: 'James Lee',
    phone: '(714) 555-0142',
    email: 'jlee@example.com',
    notes: '',
    orderCount: 3,
    lastMoveDate: '2026-06-10',
    createdAt: '2025-03-15T10:00:00Z',
  },
  {
    id: 'client-3',
    tenantId: 'mock-tenant-1',
    name: 'Anna Brooks',
    phone: '(949) 555-0188',
    email: '',
    notes: 'Has fragile antiques',
    orderCount: 2,
    lastMoveDate: '2026-06-08',
    createdAt: '2025-08-20T10:00:00Z',
  },
  {
    id: 'client-4',
    tenantId: 'mock-tenant-1',
    name: 'Tom Wilson',
    phone: '(310) 555-0177',
    email: 'twilson@example.com',
    notes: '',
    orderCount: 1,
    lastMoveDate: '2026-06-20',
    createdAt: '2026-05-30T10:00:00Z',
  },
]
```

### Mock hooks
```typescript
export const useClients = (search?: string) => useQuery({
  queryKey: ['clients', search],
  queryFn: async () => {
    await new Promise(r => setTimeout(r, 300))
    if (!search) return MOCK_CLIENTS
    const q = search.toLowerCase()
    return MOCK_CLIENTS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    )
  }
})

export const useClient = (id: string) => useQuery({
  queryKey: ['clients', id],
  queryFn: async () => MOCK_CLIENTS.find(c => c.id === id) ?? null
})

export const useUpdateClient = () => useMutation({
  mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
    await new Promise(r => setTimeout(r, 300))
    const client = MOCK_CLIENTS.find(c => c.id === id)
    if (client) client.notes = notes
    return client
  }
})

// Phone lookup for new order pre-fill
export const useClientByPhone = (phone: string) => useQuery({
  queryKey: ['clients-lookup', phone],
  queryFn: async () => {
    if (phone.length < 10) return null
    await new Promise(r => setTimeout(r, 200))
    return MOCK_CLIENTS.find(c => c.phone === phone) ?? null
  },
  enabled: phone.length >= 10,
})
```

### Sync checklist (when backend is ready)
- [ ] Replace useClients with GET /clients?search=
- [ ] Replace useClient with GET /clients/:id
- [ ] Replace useUpdateClient with PATCH /clients/:id
- [ ] Replace useClientByPhone with GET /clients?phone= lookup
- [ ] Remove all MOCK_CLIENTS data
