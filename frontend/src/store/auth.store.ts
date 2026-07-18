import { create } from 'zustand'
import type { User, Tenant } from '@/types'
import { saveToken, clearToken } from '@/lib/api'

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  setAuth: (user: User, tenant: Tenant, token?: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  setAuth: (user, tenant, token) => {
    if (token) saveToken(token)
    set({ user, tenant, isAuthenticated: true })
  },
  clearAuth: () => {
    clearToken()
    set({ user: null, tenant: null, isAuthenticated: false })
  },
}))
