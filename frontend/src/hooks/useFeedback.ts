import { useMutation } from '@tanstack/react-query'
import type { FeedbackSeverity } from '@/types'
import { apiFetch } from '@/lib/api'

export interface SubmitFeedbackInput {
  message: string
  pageUrl: string
  severity?: FeedbackSeverity
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) =>
      apiFetch<{ success: boolean; id: string }>('/feedback', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}
