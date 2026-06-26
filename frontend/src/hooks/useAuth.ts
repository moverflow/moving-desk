import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User, Tenant } from '@/types'
import { apiFetch } from '@/lib/api'
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
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterData) =>
      apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
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
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
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
    queryFn: () => apiFetch<AuthResponse>('/auth/me'),
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
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
    },
  })
}
