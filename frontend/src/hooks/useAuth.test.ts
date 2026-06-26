import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/auth.store'

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

describe('auth store', () => {
  it('setAuth makes isAuthenticated true', () => {
    const { setAuth } = useAuthStore.getState()
    setAuth(
      { id: 'user-1', email: 'owner@example.com', name: 'John Smith', role: 'owner' },
      { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
    )
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('clearAuth resets session', () => {
    const { setAuth, clearAuth } = useAuthStore.getState()
    setAuth(
      { id: 'user-1', email: 'owner@example.com', name: 'John Smith', role: 'owner' },
      { id: 'tenant-1', name: 'Best Movers', plan: 'trial' },
    )
    clearAuth()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setAuth stores user and tenant', () => {
    const user = { id: 'user-1', email: 'owner@example.com', name: 'John', role: 'owner' }
    const tenant = { id: 'tenant-1', name: 'Best Movers', plan: 'trial' }
    useAuthStore.getState().setAuth(user, tenant)
    expect(useAuthStore.getState().user).toEqual(user)
    expect(useAuthStore.getState().tenant).toEqual(tenant)
  })
})
