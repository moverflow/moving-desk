import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Order, CreateOrderData, HomeSize, OrderStatus } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawOrder {
  id: string
  tenant_id: string
  client_id: string | null
  crew_id: string | null
  status: string
  move_date: string
  from_address: string
  to_address: string
  from_floor: number | null
  to_floor: number | null
  from_elevator: boolean | null
  to_elevator: boolean | null
  home_size: string
  packing: boolean | null
  notes: string | null
  base_price: number
  total_price: number
  created_at: string | null
  updated_at: string | null
  clientName: string | null
  clientPhone: string | null
  crewName: string | null
  crewTruckLabel: string | null
}

function mapOrder(raw: RawOrder): Order {
  return {
    id: raw.id,
    tenantId: raw.tenant_id,
    clientName: raw.clientName ?? '',
    phone: raw.clientPhone ?? '',
    fromAddress: raw.from_address,
    toAddress: raw.to_address,
    moveDate: raw.move_date,
    homeSize: raw.home_size as HomeSize,
    status: raw.status as OrderStatus,
    crewId: raw.crew_id ?? undefined,
    crewName:
      raw.crewName && raw.crewTruckLabel
        ? `${raw.crewName} — ${raw.crewTruckLabel}`
        : (raw.crewName ?? undefined),
    fromFloor: raw.from_floor ?? 1,
    toFloor: raw.to_floor ?? 1,
    fromElevator: raw.from_elevator ?? false,
    toElevator: raw.to_elevator ?? false,
    packing: raw.packing ?? false,
    totalPrice: raw.total_price,
    notes: raw.notes ?? undefined,
    createdAt: raw.created_at ?? '',
  }
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const data = await apiFetch<{ orders: RawOrder[]; total: number }>('/orders')
      return data.orders.map(mapOrder)
    },
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderData) =>
      apiFetch<{ order: RawOrder }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          clientPhone: data.phone,
          clientName: data.clientName,
          ...(data.clientEmail ? { clientEmail: data.clientEmail } : {}),
          fromAddress: data.fromAddress,
          toAddress: data.toAddress,
          moveDate: data.moveDate,
          homeSize: data.homeSize,
          crewId: data.crewId,
          fromFloor: data.fromFloor,
          toFloor: data.toFloor,
          fromElevator: data.fromElevator,
          toElevator: data.toElevator,
          packing: data.packing,
          notes: data.notes,
        }),
      }).then((res) => mapOrder(res.order)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      apiFetch<{ order: RawOrder }>(`/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).then((res) => mapOrder(res.order)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}
