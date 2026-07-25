import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrewJob, CrewJobFile, HomeSize, OrderStatus } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawCrewJob {
  id: string
  status: string
  moveDate: string
  fromAddress: string
  toAddress: string
  fromFloor: number | null
  toFloor: number | null
  fromElevator: boolean | null
  toElevator: boolean | null
  homeSize: string
  packing: boolean | null
  notes: string | null
  totalPrice: number
  clientName: string | null
  clientPhone: string | null
}

function mapJob(raw: RawCrewJob): CrewJob {
  return {
    id: raw.id,
    status: raw.status as OrderStatus,
    moveDate: raw.moveDate,
    fromAddress: raw.fromAddress,
    toAddress: raw.toAddress,
    fromFloor: raw.fromFloor ?? 1,
    toFloor: raw.toFloor ?? 1,
    fromElevator: raw.fromElevator ?? false,
    toElevator: raw.toElevator ?? false,
    homeSize: raw.homeSize as HomeSize,
    packing: raw.packing ?? false,
    notes: raw.notes,
    totalPrice: raw.totalPrice,
    clientName: raw.clientName ?? '',
    clientPhone: raw.clientPhone ?? '',
  }
}

export interface CrewJobsResponse {
  jobs: CrewJob[]
  // The day boundary the server used, in the tenant's timezone. Taken from the
  // response rather than recomputed here, so the section labels can never
  // disagree with the jobs that were actually fetched.
  today: string
  tomorrow: string
}

export function useCrewJobs() {
  return useQuery<CrewJobsResponse>({
    queryKey: ['crew-jobs'],
    queryFn: async () => {
      const data = await apiFetch<{ jobs: RawCrewJob[]; today: string; tomorrow: string }>(
        '/crew/jobs',
      )
      return { jobs: data.jobs.map(mapJob), today: data.today, tomorrow: data.tomorrow }
    },
  })
}

export function useCrewJobFiles(orderId: string) {
  return useQuery<CrewJobFile[]>({
    queryKey: ['crew-job-files', orderId],
    queryFn: async () => {
      const data = await apiFetch<{ files: CrewJobFile[] }>(`/crew/jobs/${orderId}/files`)
      return data.files
    },
  })
}

export function useUpdateCrewJobStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'in_progress' | 'completed' }) =>
      apiFetch<{ success: boolean; status: OrderStatus }>(`/crew/jobs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew-jobs'] }),
  })
}
