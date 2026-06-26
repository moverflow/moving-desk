import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '@/store/auth.store'

vi.mock('@/hooks/useAuth', () => ({
  useMe: vi.fn(),
}))

import { useMe } from '@/hooks/useAuth'

const MOCK_AUTH = {
  user: { id: 'user-1', email: 'owner@example.com', name: 'John Smith', role: 'owner' },
  tenant: { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
}

function renderProtected(authenticated = false) {
  if (authenticated) {
    useAuthStore.getState().setAuth(MOCK_AUTH.user, MOCK_AUTH.tenant)
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<div>orders page</div>} />
          </Route>
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

describe('ProtectedRoute', () => {
  it('AC4 — authenticated user sees protected content', async () => {
    vi.mocked(useMe).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useMe>)
    renderProtected(true)
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })

  it('AC4 — unauthenticated with no data redirects to login', async () => {
    vi.mocked(useMe).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useMe>)
    renderProtected(false)
    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument()
    })
  })

  it('AC8 — useMe restores auth state on mount (simulates page refresh)', async () => {
    vi.mocked(useMe).mockReturnValue({ data: MOCK_AUTH, isLoading: false } as ReturnType<typeof useMe>)
    renderProtected(false)
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
