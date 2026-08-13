import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { TelegramLinkCode, TelegramStatus } from '@/types'

// Linking finishes in Telegram, not in the browser, so there is nothing to
// invalidate the status — polling is enabled only while a code is outstanding.
const LINKING_POLL_MS = 3_000

export function useTelegramStatus(awaitingLink = false) {
  return useQuery<TelegramStatus>({
    queryKey: ['telegram'],
    queryFn: () => apiFetch<TelegramStatus>('/telegram'),
    refetchInterval: awaitingLink ? LINKING_POLL_MS : false,
  })
}

export function useCreateTelegramLinkCode() {
  return useMutation({
    mutationFn: () => apiFetch<TelegramLinkCode>('/telegram/link-code', { method: 'POST' }),
  })
}

export function useDisconnectTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>('/telegram', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegram'] }),
  })
}
