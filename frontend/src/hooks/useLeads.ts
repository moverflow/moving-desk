import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Lead, LeadStatus, LeadSource } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawLead {
  id: string
  name: string
  phone: string | null
  email: string | null
  from_address: string | null
  to_address: string | null
  move_date: string | null
  home_size: string | null
  notes: string | null
  status: string
  source: string
  converted_order_id: string | null
  created_at: string | null
}

function mapLead(raw: RawLead): Lead {
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
    fromAddress: raw.from_address,
    toAddress: raw.to_address,
    moveDate: raw.move_date,
    homeSize: raw.home_size,
    notes: raw.notes,
    status: raw.status as LeadStatus,
    source: raw.source as LeadSource,
    convertedOrderId: raw.converted_order_id,
    createdAt: raw.created_at ?? '',
  }
}

export interface CreateLeadInput {
  name: string
  phone?: string
  email?: string
  fromAddress?: string
  toAddress?: string
  moveDate?: string
  homeSize?: string
  notes?: string
  source?: 'manual' | 'phone'
}

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: async () => {
      const data = await apiFetch<{ leads: RawLead[] }>('/leads')
      return data.leads.map(mapLead)
    },
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeadInput) =>
      apiFetch<{ lead: RawLead }>('/leads', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => mapLead(res.lead)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; status?: LeadStatus } & Partial<CreateLeadInput>) =>
      apiFetch<{ lead: RawLead }>(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }).then((res) => mapLead(res.lead)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useMarkLeadLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ lead: RawLead }>(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useConvertLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ orderId: string }>(`/leads/${id}/convert`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
