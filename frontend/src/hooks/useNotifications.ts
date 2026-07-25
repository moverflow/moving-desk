import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppNotification, NotificationRelatedType, NotificationType } from '@/types'
import { apiFetch } from '@/lib/api'

// Real-time push is out of scope; polling on this interval is close enough for
// a notification bell and costs one small query per tab per 30s.
const POLL_INTERVAL_MS = 30_000

const PAGE_SIZE = 20

interface RawNotification {
  id: string
  type: string
  title: string
  body: string | null
  related_type: string | null
  related_id: string | null
  read_at: string | null
  created_at: string | null
}

interface RawNotificationsResponse {
  notifications: RawNotification[]
  unreadCount: number
}

export interface NotificationsResult {
  notifications: AppNotification[]
  unreadCount: number
}

function mapNotification(raw: RawNotification): AppNotification {
  return {
    id: raw.id,
    type: raw.type as NotificationType,
    title: raw.title,
    body: raw.body,
    relatedType: raw.related_type as NotificationRelatedType | null,
    relatedId: raw.related_id,
    readAt: raw.read_at,
    createdAt: raw.created_at ?? '',
  }
}

export function useNotifications() {
  return useQuery<NotificationsResult>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await apiFetch<RawNotificationsResponse>(`/notifications?limit=${PAGE_SIZE}`)
      return {
        notifications: data.notifications.map(mapNotification),
        unreadCount: data.unreadCount,
      }
    },
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function notificationLink(notification: AppNotification): string {
  if (!notification.relatedId) return '/orders'
  switch (notification.relatedType) {
    case 'order':
      return `/orders?order=${notification.relatedId}`
    case 'invoice':
      return `/invoices?invoice=${notification.relatedId}`
    // Leads have no detail page of their own — the pipeline tab is the record view.
    case 'lead':
      return '/orders?tab=leads'
    default:
      return '/orders'
  }
}
