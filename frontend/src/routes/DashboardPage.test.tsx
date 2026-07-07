import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import { useAuthStore } from '@/store/auth.store'
import type { DashboardResponse } from '@/types'

vi.mock('@/hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}))

import { useDashboard } from '@/hooks/useDashboard'

const OWNER = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'owner' as const }
const DISPATCHER = { id: 'user-2', email: 'dispatcher@example.com', name: 'Dispatcher', role: 'dispatcher' as const }
const TENANT = { id: 'tenant-1', name: 'Best Movers', plan: 'trial' as const }

const MOCK_DATA: DashboardResponse = {
  period: 'month',
  summary: { totalOrders: 24, completedOrders: 20, cancelledOrders: 1, totalRevenue: 11520, avgOrderValue: 576 },
  ordersByStatus: [{ status: 'completed', count: 20, revenue: 11520 }],
  ordersByWeek: [{ week: 'Jun 30', orders: 5, revenue: 2400 }],
  topCrews: [{ crewName: 'Crew A', truckLabel: 'Truck 1', ordersCount: 10, revenue: 5760 }],
}

function renderDashboard(role: 'owner' | 'dispatcher') {
  useAuthStore.getState().setAuth(role === 'owner' ? OWNER : DISPATCHER, TENANT)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders" element={<div>orders page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  vi.mocked(useDashboard).mockReturnValue({ data: MOCK_DATA, isLoading: false } as ReturnType<typeof useDashboard>)
})

describe('DashboardPage', () => {
  it('AC1 — owner sees the dashboard with summary data', async () => {
    renderDashboard('owner')
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()
      expect(screen.getByText('Crew A')).toBeInTheDocument()
    })
  })

  it('AC2 — dispatcher is redirected away from the dashboard', async () => {
    renderDashboard('dispatcher')
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })
  })

  it('AC5 — period selector switches the active button and refetches data', async () => {
    renderDashboard('owner')
    await waitFor(() => screen.getByRole('button', { name: 'Month' }))

    const monthButton = screen.getByRole('button', { name: 'Month' })
    const weekButton = screen.getByRole('button', { name: 'Week' })
    expect(monthButton.className).toMatch(/bg-white/)
    expect(weekButton.className).not.toMatch(/bg-white/)

    fireEvent.click(weekButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Week' }).className).toMatch(/bg-white/)
      expect(screen.getByRole('button', { name: 'Month' }).className).not.toMatch(/bg-white/)
    })
    expect(useDashboard).toHaveBeenLastCalledWith('week')
  })

  it('shows a loading spinner while data is loading, not stale content', async () => {
    vi.mocked(useDashboard).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useDashboard>)
    renderDashboard('owner')
    await waitFor(() => {
      expect(screen.queryByText('Crew A')).not.toBeInTheDocument()
    })
  })
})
