import { useQuery } from '@tanstack/react-query'
import type { DashboardPeriod, DashboardResponse } from '@/types'
import { apiFetch } from '@/lib/api'

export function useDashboard(period: DashboardPeriod) {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', period],
    queryFn: () => apiFetch<DashboardResponse>(`/dashboard?period=${period}`),
  })
}
