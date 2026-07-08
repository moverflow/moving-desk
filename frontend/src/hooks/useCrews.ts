import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Crew } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawCrew {
  id: string
  tenant_id: string
  name: string
  truck_label: string | null
  phone: string | null
  active: boolean | null
  created_at: string | null
}

function mapCrew(raw: RawCrew): Crew {
  return {
    id: raw.id,
    name: raw.name,
    truckLabel: raw.truck_label ?? '',
    phone: raw.phone ?? undefined,
    active: raw.active ?? true,
  }
}

export function useCrews(includeInactive = false) {
  return useQuery<Crew[]>({
    queryKey: ['crews', includeInactive],
    queryFn: async () => {
      const data = await apiFetch<{ crews: RawCrew[] }>(
        includeInactive ? '/crews?includeInactive=true' : '/crews'
      )
      return data.crews.map(mapCrew)
    },
  })
}

export function useCreateCrew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; truckLabel?: string; phone?: string }) =>
      apiFetch<{ crew: RawCrew }>('/crews', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => mapCrew(res.crew)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crews'] }),
  })
}

export function useUpdateCrew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      name?: string
      truckLabel?: string
      phone?: string
      active?: boolean
    }) =>
      apiFetch<{ crew: RawCrew }>(`/crews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }).then((res) => mapCrew(res.crew)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crews'] }),
  })
}
