import { useMutation, useQuery } from '@tanstack/react-query'
import type { User } from '@/types'
import { MOCK_USER, MOCK_TENANT, useAuthStore } from '@/store/auth.store'

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

export function useRegister() {
  return useMutation({
    mutationFn: async (_data: RegisterData) => {
      await new Promise<void>((r) => setTimeout(r, 800))
      return { user: MOCK_USER, tenant: MOCK_TENANT }
    },
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
    },
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: LoginData) => {
      await new Promise<void>((r) => setTimeout(r, 600))
      if (data.email !== 'owner@bestmovers.com') {
        throw new Error('Invalid email or password')
      }
      return { user: MOCK_USER, tenant: MOCK_TENANT }
    },
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 200))
    },
    onSuccess: () => {
      useAuthStore.getState().clearAuth()
    },
  })
}

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => MOCK_USER,
    retry: false,
  })
}

export function useJoin() {
  return useMutation({
    mutationFn: async (_data: JoinData) => {
      await new Promise<void>((r) => setTimeout(r, 800))
      return { user: MOCK_USER, tenant: MOCK_TENANT }
    },
    onSuccess: ({ user, tenant }) => {
      useAuthStore.getState().setAuth(user, tenant)
    },
  })
}
