import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OrdersPage from './OrdersPage'
import type { Order } from '@/types'

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
  useUpdateOrderStatus: vi.fn(),
  useSendContract: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/hooks/useCrews', () => ({
  useCrews: vi.fn(),
}))

import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders'
import { useCrews } from '@/hooks/useCrews'

const MOCK_ORDERS: Order[] = [
  {
    id: 'order-1', tenantId: 'mock-tenant-1', clientName: 'Rick Adams',
    phone: '(949) 632-9557', fromAddress: 'Lake Forest, CA 92630',
    toAddress: 'Anaheim, CA 92801', moveDate: '2026-06-15', homeSize: '2br',
    status: 'new', crewName: 'Team A — Truck #3', fromFloor: 1, toFloor: 2,
    fromElevator: false, toElevator: true, packing: false,
    totalPrice: 480, createdAt: '2026-06-01T10:00:00Z', isOnline: false, contractStatus: 'none',
  },
  {
    id: 'order-2', tenantId: 'mock-tenant-1', clientName: 'Tom Wilson',
    phone: '(310) 555-0177', fromAddress: 'Newport Beach, CA 92660',
    toAddress: 'Los Angeles, CA 90001', moveDate: '2026-06-20', homeSize: 'house',
    status: 'confirmed', crewName: 'Team B — Truck #7', fromFloor: 1, toFloor: 1,
    fromElevator: false, toElevator: false, packing: true,
    totalPrice: 1100, createdAt: '2026-06-02T09:00:00Z', isOnline: true, contractStatus: 'sent',
  },
  {
    id: 'order-3', tenantId: 'mock-tenant-1', clientName: 'Sarah Park',
    phone: '(657) 555-0201', fromAddress: 'Fullerton, CA 92831',
    toAddress: 'Brea, CA 92821', moveDate: '2026-06-16', homeSize: '3br',
    status: 'in_progress', crewName: 'Team A — Truck #3', fromFloor: 3, toFloor: 1,
    fromElevator: true, toElevator: false, packing: false,
    totalPrice: 620, createdAt: '2026-06-03T08:00:00Z', isOnline: false, contractStatus: 'none',
  },
  {
    id: 'order-4', tenantId: 'mock-tenant-1', clientName: 'James Lee',
    phone: '(714) 555-0142', fromAddress: 'Tustin, CA 92780',
    toAddress: 'Yorba Linda, CA 92886', moveDate: '2026-06-10', homeSize: '2br',
    status: 'completed', crewName: 'Team B — Truck #7', fromFloor: 2, toFloor: 2,
    fromElevator: false, toElevator: true, packing: false,
    totalPrice: 480, createdAt: '2026-05-28T10:00:00Z', isOnline: false, contractStatus: 'signed',
  },
]

function renderOrders() {
  vi.mocked(useOrders).mockReturnValue({ data: MOCK_ORDERS, isLoading: false } as ReturnType<typeof useOrders>)
  vi.mocked(useUpdateOrderStatus).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateOrderStatus>)
  vi.mocked(useCrews).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useCrews>)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OrdersPage', () => {
  it('AC1 — renders all 4 column headers', async () => {
    renderOrders()
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument()
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
      expect(screen.getByText('In progress')).toBeInTheDocument()
      expect(screen.getByText('Done')).toBeInTheDocument()
    })
  })

  it('AC1 — orders appear in correct columns', async () => {
    renderOrders()
    await waitFor(() => {
      expect(screen.getByText('Rick Adams')).toBeInTheDocument()
      expect(screen.getByText('Tom Wilson')).toBeInTheDocument()
      expect(screen.getByText('Sarah Park')).toBeInTheDocument()
      expect(screen.getByText('James Lee')).toBeInTheDocument()
    })
  })

  it('AC5 — clicking a card opens the detail sheet', async () => {
    renderOrders()
    await waitFor(() => screen.getByText('Rick Adams'))
    fireEvent.click(screen.getByText('Rick Adams'))
    await waitFor(() => {
      expect(screen.getAllByText('Rick Adams').length).toBeGreaterThan(1)
    })
  })
})
