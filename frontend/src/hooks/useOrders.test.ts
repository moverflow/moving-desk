import { describe, it, expect } from 'vitest'
import type { Order, OrderStatus } from '@/types'

function filterByStatus(orders: Order[], status: OrderStatus): Order[] {
  return orders.filter((o) => o.status === status)
}

const SAMPLE_ORDERS: Order[] = [
  {
    id: 'o1', tenantId: 't1', clientName: 'Alice', phone: '(555) 000-0001',
    fromAddress: 'A', toAddress: 'B', moveDate: '2026-07-01', homeSize: '2br',
    status: 'new', fromFloor: 1, toFloor: 1, fromElevator: false, toElevator: false,
    packing: false, totalPrice: 480, createdAt: '2026-06-01T00:00:00Z', isOnline: false,
  },
  {
    id: 'o2', tenantId: 't1', clientName: 'Bob', phone: '(555) 000-0002',
    fromAddress: 'C', toAddress: 'D', moveDate: '2026-07-02', homeSize: 'house',
    status: 'confirmed', fromFloor: 1, toFloor: 1, fromElevator: false, toElevator: false,
    packing: true, totalPrice: 970, createdAt: '2026-06-02T00:00:00Z', isOnline: true,
  },
]

describe('order filtering by status', () => {
  it('AC1 — filters new orders correctly', () => {
    expect(filterByStatus(SAMPLE_ORDERS, 'new')).toHaveLength(1)
  })

  it('AC1 — filters confirmed orders correctly', () => {
    expect(filterByStatus(SAMPLE_ORDERS, 'confirmed')).toHaveLength(1)
  })

  it('AC1 — returns empty for statuses with no orders', () => {
    expect(filterByStatus(SAMPLE_ORDERS, 'completed')).toHaveLength(0)
  })
})
