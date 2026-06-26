import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Client } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawClient {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string | null
  orderCount: number
}

function mapClient(raw: RawClient): Client {
  return {
    id: raw.id,
    tenantId: raw.tenant_id,
    name: raw.name,
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    notes: raw.notes ?? '',
    orderCount: raw.orderCount,
    createdAt: raw.created_at ?? '',
  }
}

export function useClients(search?: string) {
  return useQuery<Client[]>({
    queryKey: ['clients', search ?? ''],
    queryFn: async () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await apiFetch<{ clients: RawClient[] }>(`/clients${qs}`)
      return data.clients.map(mapClient)
    },
  })
}

export function useClient(id: string) {
  return useQuery<Client | null>({
    queryKey: ['client', id],
    queryFn: async () => {
      const data = await apiFetch<{ client: RawClient & { orders?: unknown[] } }>(`/clients/${id}`)
      return mapClient(data.client)
    },
    enabled: id.length > 0,
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiFetch<{ client: RawClient }>(`/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }).then((res) => mapClient(res.client)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useClientByPhone(phone: string) {
  return useQuery<Client | null>({
    queryKey: ['client-lookup', phone],
    queryFn: async () => {
      const data = await apiFetch<{ clients: RawClient[] }>(
        `/clients?search=${encodeURIComponent(phone)}`
      )
      const exact = data.clients.find((c) => c.phone === phone)
      return exact ? mapClient(exact) : null
    },
    enabled: phone.length >= 10,
  })
}
