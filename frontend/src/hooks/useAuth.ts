import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User, Tenant } from '@/types'
import { apiFetch, saveToken } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

interface RegisterData {
  companyName: string
  name: string
  email: string
  password: string
}

interface LoginData {
  email: string
  password: string
}

interface JoinData {
  name: string
  password: string
  token: string
}

interface AuthResponse {
  user: User
  tenant: Tenant
  // Present when the backend hands back the JWT for the iOS Safari localStorage
  // fallback (login/register/join/me).
  token?: string
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterData) =>
      apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: ({ user, tenant, token }) => {
      useAuthStore.getState().setAuth(user, tenant, token)
    },
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginData) =>
      apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: ({ user, tenant, token }) => {
      useAuthStore.getState().setAuth(user, tenant, token)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      useAuthStore.getState().clearAuth()
      queryClient.removeQueries()
    },
  })
}

export function useMe() {
  return useQuery<AuthResponse>({
    queryKey: ['me'],
    // Refresh the stored fallback token on every successful /me. (queryFn
    // side-effect rather than onSuccess, which useQuery dropped in v5.)
    queryFn: async () => {
      const data = await apiFetch<AuthResponse>('/auth/me')
      if (data.token) saveToken(data.token)
      return data
    },
    retry: false,
  })
}

export function useJoin() {
  return useMutation({
    mutationFn: (data: JoinData) =>
      apiFetch<AuthResponse>('/users/join', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: ({ user, tenant, token }) => {
      useAuthStore.getState().setAuth(user, tenant, token)
    },
  })
}
