import { useMutation, useQuery } from '@tanstack/react-query'
import type { AIChatResponse, AIInsightsResponse } from '@/types'
import { apiFetch } from '@/lib/api'

export function useAIInsights() {
  return useQuery<AIInsightsResponse>({
    queryKey: ['ai-insights'],
    queryFn: () => apiFetch<AIInsightsResponse>('/dashboard/ai-insights'),
    staleTime: 1000 * 60 * 60,
  })
}

export function useAIChat() {
  return useMutation<AIChatResponse, Error, string>({
    mutationFn: (message: string) =>
      apiFetch<AIChatResponse>('/dashboard/ai-chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  })
}
