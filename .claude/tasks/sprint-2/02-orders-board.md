# Task: Orders Board UI
**Sprint:** 2
**Scope:** frontend
**ID:** sprint-2/02-orders-board

## What to build

### Kanban board (OrdersPage)
4 columns: New | Confirmed | In progress | Done
Each column shows order cards.
Column header shows count badge.

### Order card
- Client name (bold)
- From → To (short, truncated)
- Move date
- Home size badge
- Crew name (if assigned)
- Color left border by status:
  New=blue, Confirmed=amber, In progress=green, Done=gray

### New order form (NewOrderPage)
Single screen — no wizard.
Fields:
  Phone (lookup on blur → auto-fill name/address)
  Client name
  From address
  To address
  Move date (date picker)
  Home size (pill buttons: Studio/1BR/2BR/3BR/House)
  From floor / To floor (number inputs)
  From elevator / To elevator (toggles)
  Packing (toggle)
  Assign crew (select from tenant crews)
  Notes (textarea)
  Live price calculation shown below form
Save button → POST /orders → redirect to board

### Status update
Click card → slide-over panel with order details
Status dropdown to change status
Save button → PATCH /orders/:id

## Acceptance criteria
- AC1: Board shows orders in correct columns
- AC2: Phone blur → auto-fills client data if found
- AC3: Size pills update live price
- AC4: Save creates order, card appears on board
- AC5: Status change moves card to correct column

---

## Mock mode (use until backend is ready)

### Mock data
```typescript
// hooks/useOrders.ts
import type { Order } from '../types'

const MOCK_ORDERS: Order[] = [
  {
    id: 'order-1',
    tenantId: 'mock-tenant-1',
    clientName: 'Rick Adams',
    phone: '(949) 632-9557',
    fromAddress: 'Lake Forest, CA 92630',
    toAddress: 'Anaheim, CA 92801',
    moveDate: '2026-06-15',
    homeSize: '2br',
    status: 'new',
    crewName: 'Team A — Truck #3',
    fromFloor: 1,
    toFloor: 2,
    fromElevator: false,
    toElevator: true,
    packing: false,
    totalPrice: 480,
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'order-2',
    tenantId: 'mock-tenant-1',
    clientName: 'Tom Wilson',
    phone: '(310) 555-0177',
    fromAddress: 'Newport Beach, CA 92660',
    toAddress: 'Los Angeles, CA 90001',
    moveDate: '2026-06-20',
    homeSize: 'house',
    status: 'confirmed',
    crewName: 'Team B — Truck #7',
    fromFloor: 1,
    toFloor: 1,
    fromElevator: false,
    toElevator: false,
    packing: true,
    totalPrice: 1100,
    createdAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'order-3',
    tenantId: 'mock-tenant-1',
    clientName: 'Sarah Park',
    phone: '(657) 555-0201',
    fromAddress: 'Fullerton, CA 92831',
    toAddress: 'Brea, CA 92821',
    moveDate: '2026-06-16',
    homeSize: '3br',
    status: 'in_progress',
    crewName: 'Team A — Truck #3',
    fromFloor: 3,
    toFloor: 1,
    fromElevator: true,
    toElevator: false,
    packing: false,
    totalPrice: 620,
    createdAt: '2026-06-03T08:00:00Z',
  },
  {
    id: 'order-4',
    tenantId: 'mock-tenant-1',
    clientName: 'James Lee',
    phone: '(714) 555-0142',
    fromAddress: 'Tustin, CA 92780',
    toAddress: 'Yorba Linda, CA 92886',
    moveDate: '2026-06-10',
    homeSize: '2br',
    status: 'completed',
    crewName: 'Team B — Truck #7',
    fromFloor: 2,
    toFloor: 2,
    fromElevator: false,
    toElevator: true,
    packing: false,
    totalPrice: 480,
    createdAt: '2026-05-28T10:00:00Z',
  },
]

const MOCK_CREWS = [
  { id: 'crew-1', name: 'Team A', truckLabel: 'Truck #3' },
  { id: 'crew-2', name: 'Team B', truckLabel: 'Truck #7' },
]

// Base rates for price calculation
const MOCK_BASE_RATES: Record<string, number> = {
  studio: 280,
  '1br': 380,
  '2br': 480,
  '3br': 620,
  house: 850,
}
```

### Mock hooks
```typescript
export const useOrders = (filters?: { status?: string }) => useQuery({
  queryKey: ['orders', filters],
  queryFn: async () => {
    await new Promise(r => setTimeout(r, 300))
    if (filters?.status) {
      return MOCK_ORDERS.filter(o => o.status === filters.status)
    }
    return MOCK_ORDERS
  }
})

export const useCreateOrder = () => useMutation({
  mutationFn: async (data) => {
    await new Promise(r => setTimeout(r, 600))
    const newOrder: Order = {
      id: 'order-' + Date.now(),
      tenantId: 'mock-tenant-1',
      status: 'new',
      totalPrice: MOCK_BASE_RATES[data.homeSize] + (data.packing ? 120 : 0),
      ...data,
    }
    MOCK_ORDERS.push(newOrder)
    return newOrder
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
})

export const useUpdateOrderStatus = () => useMutation({
  mutationFn: async ({ id, status }: { id: string; status: string }) => {
    await new Promise(r => setTimeout(r, 300))
    const order = MOCK_ORDERS.find(o => o.id === id)
    if (order) order.status = status
    return order
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
})

export const useCrews = () => useQuery({
  queryKey: ['crews'],
  queryFn: async () => MOCK_CREWS
})
```

### Mock price calculation
```typescript
// lib/pricing.ts
export const calculatePrice = (
  homeSize: string,
  packing: boolean,
  baseRates = MOCK_BASE_RATES
): number => {
  const base = baseRates[homeSize] ?? 480
  return base + (packing ? 120 : 0)
}
```

### Sync checklist (when backend is ready)
- [ ] Replace useOrders queryFn with GET /orders
- [ ] Replace useCreateOrder mutationFn with POST /orders
- [ ] Replace useUpdateOrderStatus with PATCH /orders/:id
- [ ] Replace useCrews with GET /crews
- [ ] Replace MOCK_BASE_RATES with tenant settings from API
- [ ] Remove all MOCK_* constants
