import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage'
import { useAuthStore } from '@/store/auth.store'
import { ApiError } from '@/lib/api'

vi.mock('@/hooks/useAuth', () => ({
  useLogin: vi.fn(),
}))

import { useLogin } from '@/hooks/useAuth'

const MOCK_AUTH = {
  user: { id: 'user-1', email: 'owner@bestmovers.com', name: 'John Smith', role: 'owner' },
  tenant: { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/orders" element={<div>orders page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders email and password fields with submit button', () => {
    vi.mocked(useLogin).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useLogin>)
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('AC2 — correct credentials redirects to /orders', async () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: vi.fn((_data, opts) => opts?.onSuccess?.(MOCK_AUTH)),
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'owner@bestmovers.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })

  it('AC3 — wrong email shows inline error without redirect', async () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: vi.fn((_data, opts) => opts?.onError?.(new ApiError(401, 'Invalid credentials'))),
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows password toggle button', () => {
    vi.mocked(useLogin).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useLogin>)
    renderLogin()
    const toggle = screen.getByRole('button', { name: '' })
    expect(toggle).toBeInTheDocument()
  })

  it('has link to register page', () => {
    vi.mocked(useLogin).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useLogin>)
    renderLogin()
    expect(screen.getByRole('link', { name: /start free trial/i })).toHaveAttribute('href', '/register')
  })
})
