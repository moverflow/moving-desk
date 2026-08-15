import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, saveToken } from '@/lib/api'
import type {
  AssistantPendingAction,
  AssistantSessionResponse,
  AssistantTranscript,
} from '@/types'

const TRANSCRIPT_KEY = ['assistant', 'messages']

export function useAssistantConfig() {
  return useQuery<{ enabled: boolean }>({
    queryKey: ['assistant', 'config'],
    queryFn: () => apiFetch<{ enabled: boolean }>('/assistant/config'),
    staleTime: Infinity,
  })
}

// Exchanges Telegram's signed initData for the app's own JWT. On success the
// token is stored the same way a browser login stores it, so every later request
// goes through the normal authenticated path.
export function useAssistantSession() {
  return useMutation({
    mutationFn: async (initData: string) => {
      const result = await apiFetch<AssistantSessionResponse>('/assistant/session', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      })
      if (result.linked) saveToken(result.token)
      return result
    },
  })
}

// The linking-code flow from Settings → Integrations, run from inside Telegram.
export function useAssistantLink() {
  return useMutation({
    mutationFn: async ({ initData, code }: { initData: string; code: string }) => {
      const result = await apiFetch<AssistantSessionResponse>('/assistant/link', {
        method: 'POST',
        body: JSON.stringify({ initData, code: code.trim().toUpperCase() }),
      })
      if (result.linked) saveToken(result.token)
      return result
    },
  })
}

export function useAssistantTranscript(enabled: boolean) {
  return useQuery<AssistantTranscript>({
    queryKey: TRANSCRIPT_KEY,
    queryFn: () => apiFetch<AssistantTranscript>('/assistant/messages'),
    enabled,
  })
}

// Every reply returns the whole transcript, so the response replaces the cache
// rather than invalidating it — no second round trip, and the pending action
// state can never lag the messages it belongs to.
export function useSendAssistantMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<AssistantTranscript>('/assistant/messages', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    onSuccess: (transcript) => queryClient.setQueryData(TRANSCRIPT_KEY, transcript),
  })
}

export function useResolveAssistantAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      action,
      decision,
    }: {
      action: AssistantPendingAction
      decision: 'confirm' | 'reject'
    }) =>
      apiFetch<AssistantTranscript>('/assistant/actions', {
        method: 'POST',
        body: JSON.stringify({
          messageId: action.messageId,
          toolUseId: action.toolUseId,
          decision,
        }),
      }),
    onSuccess: (transcript) => queryClient.setQueryData(TRANSCRIPT_KEY, transcript),
    // A 409 means someone already answered this one, so the cached transcript is
    // stale — refetch instead of leaving a dead confirm button on screen.
    onError: () => queryClient.invalidateQueries({ queryKey: TRANSCRIPT_KEY }),
  })
}
