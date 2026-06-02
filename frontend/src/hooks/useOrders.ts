import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Order, Crew, CreateOrderData, OrderStatus } from '@/types'
import { calculatePrice } from '@/lib/pricing'

const MOCK_ORDERS: Order[] = [
  {
    id: 'order-1', tenantId: 'mock-tenant-1', clientName: 'Rick Adams',
    phone: '(949) 632-9557', fromAddress: 'Lake Forest, CA 92630',
    toAddress: 'Anaheim, CA 92801', moveDate: '2026-06-15', homeSize: '2br',
    status: 'new', crewName: 'Team A — Truck #3', fromFloor: 1, toFloor: 2,
    fromElevator: false, toElevator: true, packing: false,
    totalPrice: 480, createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'order-2', tenantId: 'mock-tenant-1', clientName: 'Tom Wilson',
    phone: '(310) 555-0177', fromAddress: 'Newport Beach, CA 92660',
    toAddress: 'Los Angeles, CA 90001', moveDate: '2026-06-20', homeSize: 'house',
    status: 'confirmed', crewName: 'Team B — Truck #7', fromFloor: 1, toFloor: 1,
    fromElevator: false, toElevator: false, packing: true,
    totalPrice: 1100, createdAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'order-3', tenantId: 'mock-tenant-1', clientName: 'Sarah Park',
    phone: '(657) 555-0201', fromAddress: 'Fullerton, CA 92831',
    toAddress: 'Brea, CA 92821', moveDate: '2026-06-16', homeSize: '3br',
    status: 'in_progress', crewName: 'Team A — Truck #3', fromFloor: 3, toFloor: 1,
    fromElevator: true, toElevator: false, packing: false,
    totalPrice: 620, createdAt: '2026-06-03T08:00:00Z',
  },
  {
    id: 'order-4', tenantId: 'mock-tenant-1', clientName: 'James Lee',
    phone: '(714) 555-0142', fromAddress: 'Tustin, CA 92780',
    toAddress: 'Yorba Linda, CA 92886', moveDate: '2026-06-10', homeSize: '2br',
    status: 'completed', crewName: 'Team B — Truck #7', fromFloor: 2, toFloor: 2,
    fromElevator: false, toElevator: true, packing: false,
    totalPrice: 480, createdAt: '2026-05-28T10:00:00Z',
  },
]

const MOCK_CREWS: Crew[] = [
  { id: 'crew-1', name: 'Team A', truckLabel: 'Truck #3' },
  { id: 'crew-2', name: 'Team B', truckLabel: 'Truck #7' },
]

const MOCK_CLIENT_LOOKUP: Record<string, { clientName: string; fromAddress: string }> = {
  '(949) 632-9557': { clientName: 'Rick Adams', fromAddress: 'Lake Forest, CA 92630' },
  '(310) 555-0177': { clientName: 'Tom Wilson', fromAddress: 'Newport Beach, CA 92660' },
  '(657) 555-0201': { clientName: 'Sarah Park', fromAddress: 'Fullerton, CA 92831' },
  '(714) 555-0142': { clientName: 'James Lee', fromAddress: 'Tustin, CA 92780' },
}

export function findClientByPhone(phone: string): { clientName: string; fromAddress: string } | null {
  return MOCK_CLIENT_LOOKUP[phone] ?? null
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 300))
      return [...MOCK_ORDERS]
    },
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      await new Promise<void>((r) => setTimeout(r, 600))
      const crew = MOCK_CREWS.find((c) => c.id === data.crewId)
      const newOrder: Order = {
        id: `order-${Date.now()}`,
        tenantId: 'mock-tenant-1',
        status: 'new',
        totalPrice: calculatePrice(data.homeSize, data.packing),
        crewName: crew ? `${crew.name} — ${crew.truckLabel}` : undefined,
        createdAt: new Date().toISOString(),
        ...data,
      }
      MOCK_ORDERS.push(newOrder)
      return newOrder
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      await new Promise<void>((r) => setTimeout(r, 300))
      const order = MOCK_ORDERS.find((o) => o.id === id)
      if (order) order.status = status
      return order
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useCrews() {
  return useQuery<Crew[]>({
    queryKey: ['crews'],
    queryFn: async () => MOCK_CREWS,
  })
}
