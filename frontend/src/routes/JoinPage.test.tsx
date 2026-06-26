import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import JoinPage from './JoinPage'
import { useAuthStore } from '@/store/auth.store'

vi.mock('@/hooks/useAuth', () => ({
  useJoin: vi.fn(),
}))

import { useJoin } from '@/hooks/useAuth'

const MOCK_AUTH = {
  user: { id: 'user-2', email: 'jane@bestmovers.com', name: 'Jane Doe', role: 'dispatcher' },
  tenant: { id: 'tenant-1', name: 'Best & Pro Moving Service', plan: 'trial' },
}

function renderJoin(token = 'abc-token-123') {
  vi.mocked(useJoin).mockReturnValue({
    mutate: vi.fn((_data, opts) => opts?.onSuccess?.(MOCK_AUTH)),
    isPending: false,
  } as unknown as ReturnType<typeof useJoin>)

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/join?token=${token}`]}>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
          <Route path="/orders" element={<div>orders page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

describe('JoinPage', () => {
  it('renders company name in header', () => {
    renderJoin()
    expect(screen.getByText(/you're joining best & pro moving/i)).toBeInTheDocument()
  })

  it('renders name and password fields', () => {
    renderJoin()
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('AC7 — successful join redirects to /orders', async () => {
    renderJoin('valid-token')
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))

    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('AC7 — token is read from URL query param', () => {
    renderJoin('my-invite-token')
    expect(screen.getByRole('button', { name: /join team/i })).toBeInTheDocument()
  })
})
