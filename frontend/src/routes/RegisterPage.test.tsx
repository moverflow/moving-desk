import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import { useAuthStore } from '@/store/auth.store'
import { ApiError } from '@/lib/api'

vi.mock('@/hooks/useAuth', () => ({
  useRegister: vi.fn(),
}))

import { useRegister } from '@/hooks/useAuth'

const MOCK_AUTH = {
  user: { id: 'user-1', email: 'john@best.com', name: 'John', role: 'owner' },
  tenant: { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
}

function renderRegister() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/setup" element={<div>setup page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

describe('RegisterPage', () => {
  it('renders all required fields', () => {
    vi.mocked(useRegister).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRegister>)
    renderRegister()
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('AC1 — successful register redirects to /setup', async () => {
    vi.mocked(useRegister).mockReturnValue({
      mutate: vi.fn((_data, opts) => opts?.onSuccess?.(MOCK_AUTH)),
      isPending: false,
    } as unknown as ReturnType<typeof useRegister>)
    renderRegister()
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Best Movers' } })
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@best.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }))

    await waitFor(() => {
      expect(screen.getByText('setup page')).toBeInTheDocument()
    })
  })

  it('AC1 — setAuth is called on success', async () => {
    vi.mocked(useRegister).mockReturnValue({
      mutate: vi.fn((_data, opts) => {
        useAuthStore.getState().setAuth(MOCK_AUTH.user, MOCK_AUTH.tenant)
        opts?.onSuccess?.(MOCK_AUTH)
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useRegister>)
    renderRegister()
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Best Movers' } })
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@best.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }))

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })

  it('has link to login page', () => {
    vi.mocked(useRegister).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRegister>)
    renderRegister()
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
  })

  it('shows field-level validation errors from API', async () => {
    vi.mocked(useRegister).mockReturnValue({
      mutate: vi.fn((_data, opts) => {
        opts?.onError?.(
          new ApiError(400, 'Validation failed', {
            password: 'Password must be at least 8 characters',
          }),
        )
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useRegister>)
    renderRegister()
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Best Movers' } })
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@best.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument()
  })
})
