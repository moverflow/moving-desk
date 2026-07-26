import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Settings, TeamMember, Subscription } from '@/types'
import { apiFetch, apiUpload } from '@/lib/api'
import type { Pricing } from '@/lib/pricing'

interface RawTeamMember {
  id: string
  name: string
  email: string
  role: string
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<Settings>('/settings'),
  })
}

// Tenant pricing for any authenticated role. Separate from useSettings because
// GET /settings is owner-only, but dispatchers also need real rates to preview
// an order price that matches what the backend will actually charge.
export function usePricing() {
  return useQuery<Pricing>({
    queryKey: ['pricing'],
    queryFn: () => apiFetch<Pricing>('/settings/pricing'),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Settings>) =>
      apiFetch<Settings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
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

interface InviteInput {
  email: string
  role: 'dispatcher' | 'crew'
  crewId?: string
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role, crewId }: InviteInput) =>
      apiFetch<{ message: string; email: string; token: string }>('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role, ...(role === 'crew' && crewId ? { crewId } : {}) }),
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
