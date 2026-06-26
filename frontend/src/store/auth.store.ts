import { create } from 'zustand'
import type { User, Tenant } from '@/types'

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  setAuth: (user: User, tenant: Tenant) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true }),
  clearAuth: () => set({ user: null, tenant: null, isAuthenticated: false }),
}))
