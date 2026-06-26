import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Settings, TeamMember, Subscription } from '@/types'
import { apiFetch, apiUpload } from '@/lib/api'
import { ACTIVE_RATES } from '@/lib/pricing'

interface RawTeamMember {
  id: string
  name: string
  email: string
  role: string
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const data = await apiFetch<Settings>('/settings')
      if (data.baseRates) Object.assign(ACTIVE_RATES, data.baseRates)
      return data
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const updated = await apiFetch<Settings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      if (updated.baseRates) Object.assign(ACTIVE_RATES, updated.baseRates)
      return updated
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useUploadLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiUpload<{ url: string }>('/settings/logo', formData)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const data = await apiFetch<{ users: RawTeamMember[] }>('/users')
      return data.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as TeamMember['role'],
      }))
    },
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ message: string; email: string }>('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: () => apiFetch<Subscription>('/billing/subscription'),
  })
}
