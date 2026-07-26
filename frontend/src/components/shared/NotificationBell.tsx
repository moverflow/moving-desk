import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { AppNotification } from '@/types'
import {
  notificationLink,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/utils'

const TYPE_ICONS: Record<AppNotification['type'], string> = {
  lead_new: '🎯',
  contract_signed: '✍️',
  invoice_paid: '💰',
  move_reminder: '🚚',
  feedback_new: '💬',
}

interface NotificationRowProps {
  notification: AppNotification
  onSelect: (notification: AppNotification) => void
}

function NotificationRow({ notification, onSelect }: NotificationRowProps): JSX.Element {
  const isUnread = notification.readAt === null
  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={`w-full flex gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 ${isUnread ? 'bg-[#1d9e75]/5' : ''}`}
    >
      <span aria-hidden className="text-sm leading-5">{TYPE_ICONS[notification.type] ?? '🔔'}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="block truncate text-xs text-muted-foreground">{notification.body}</span>
        )}
        <span className="block text-[11px] text-muted-foreground">
          {notification.createdAt ? formatRelativeTime(new Date(notification.createdAt)) : ''}
        </span>
      </span>
      {isUnread && <span aria-label="Unread" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d9e75]" />}
    </button>
  )
}

interface NotificationPanelProps {
  notifications: AppNotification[]
  unreadCount: number
  isMarkingAll: boolean
  onMarkAllRead: () => void
  onSelect: (notification: AppNotification) => void
}

function NotificationPanel({
  notifications,
  unreadCount,
  isMarkingAll,
  onMarkAllRead,
  onSelect,
}: NotificationPanelProps): JSX.Element {
  return (
    <div role="menu" className="absolute right-0 top-full mt-2 w-80 rounded-md border bg-white shadow-lg z-50">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-medium">Notifications</p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            className="text-xs text-[#1d9e75] hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y">
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</p>
        ) : (
          notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  )
}

export default function NotificationBell(): JSX.Element {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data } = useNotifications()
  const { mutate: markRead } = useMarkNotificationRead()
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead()

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(notification: AppNotification): void {
    if (notification.readAt === null) markRead(notification.id)
    setOpen(false)
    navigate(notificationLink(notification))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative h-8 w-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-[#1d9e75] px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          isMarkingAll={isMarkingAll}
          onMarkAllRead={() => markAllRead()}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}
