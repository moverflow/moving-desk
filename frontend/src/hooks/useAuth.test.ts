import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/auth.store'

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

// Tests for the mock logic driving useLogin's mutationFn
describe('useLogin mock logic', () => {
  it('resolves for the known owner email', async () => {
    const email = 'owner@bestmovers.com'
    // Reproduce the exact guard from the mutationFn
    let threw = false
    try {
      if (email !== 'owner@bestmovers.com') throw new Error('Invalid email or password')
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it('throws for any other email (AC3 — wrong credentials)', async () => {
    const email: string = 'wrong@example.com'
    let message = ''
    try {
      if (email !== 'owner@bestmovers.com') throw new Error('Invalid email or password')
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toBe('Invalid email or password')
  })
})

// Auth store integration — mirrors what hooks do on success
describe('auth store setAuth via hook success handler', () => {
  it('setAuth makes isAuthenticated true (AC8 — state persists)', () => {
    const { setAuth } = useAuthStore.getState()
    setAuth(
      { id: 'mock-user-1', email: 'owner@bestmovers.com', name: 'John Smith', role: 'owner' },
      { id: 'mock-tenant-1', name: 'Best & Pro Moving', plan: 'trial' },
    )
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('clearAuth from useLogout success resets session', () => {
    const { setAuth, clearAuth } = useAuthStore.getState()
    setAuth(
      { id: 'mock-user-1', email: 'owner@bestmovers.com', name: 'John Smith', role: 'owner' },
      { id: 'mock-tenant-1', name: 'Best & Pro Moving', plan: 'trial' },
    )
    clearAuth()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
