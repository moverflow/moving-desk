import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JSX, ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLogout } from './useAuth'
import { useAuthStore } from '@/store/auth.store'
import { ApiError } from '@/lib/api'

const apiFetchMock = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  }
})

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function signIn(): void {
  useAuthStore
    .getState()
    .setAuth(
      { id: 'user-1', email: 'owner@example.com', name: 'John Smith', role: 'owner' },
      { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
      'a-jwt',
    )
}

beforeEach(() => {
  apiFetchMock.mockReset()
  useAuthStore.getState().clearAuth()
  localStorage.clear()
})

describe('useLogout', () => {
  it('clears local auth state when the API call succeeds', async () => {
    apiFetchMock.mockResolvedValue({ message: 'Logged out' })
    signIn()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('still logs the user out when the API call fails — shared-device safety', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(401, 'Unauthorized'))
    signIn()

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('still logs the user out when the network is unreachable', async () => {
    apiFetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    signIn()

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
  })

  it('removes the stored Bearer token even when the API call fails', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'Server error'))
    signIn()
    expect(localStorage.getItem('md_auth_token')).toBe('a-jwt')

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(localStorage.getItem('md_auth_token')).toBeNull())
  })
})
