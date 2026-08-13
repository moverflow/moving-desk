import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { isTelegramEnabled, sendTelegramMessage } from '../lib/telegram.js'
import type { NotificationRelatedType, NotificationType } from '../types/index.js'
import { listTenantChatIds } from './telegram.service.js'

export interface TelegramNotificationInput {
  tenantId: string
  type: NotificationType
  title: string
  body?: string | null
  relatedType?: NotificationRelatedType | null
  relatedId?: string | null
}

const TYPE_ICONS: Record<NotificationType, string> = {
  lead_new: '🎯',
  contract_signed: '✍️',
  invoice_paid: '💰',
  invoice_refunded: '↩️',
  invoice_disputed: '⚠️',
  move_reminder: '🚚',
  feedback_new: '💬',
}

// Mirrors notificationLink() on the frontend: same targets, so tapping the link
// in Telegram lands where clicking the bell item would.
function appLink(relatedType: NotificationRelatedType | null, relatedId: string | null): string {
  if (!relatedId) return `${env.FRONTEND_URL}/orders`
  switch (relatedType) {
    case 'order':
      return `${env.FRONTEND_URL}/orders?order=${relatedId}`
    case 'invoice':
      return `${env.FRONTEND_URL}/invoices?invoice=${relatedId}`
    case 'lead':
      return `${env.FRONTEND_URL}/orders?tab=leads`
    default:
      return `${env.FRONTEND_URL}/orders`
  }
}

function formatMessage(input: TelegramNotificationInput): string {
  const icon = TYPE_ICONS[input.type] ?? '🔔'
  const lines = [`${icon} ${input.title}`]
  if (input.body) lines.push(input.body)
  lines.push(appLink(input.relatedType ?? null, input.relatedId ?? null))
  return lines.join('\n')
}

// The Telegram half of an in-app notification. Same contract as
// createNotification: every failure is logged and swallowed, so the booking,
// signature or payment that triggered it is never affected. Never rejects.
export async function dispatchTelegramNotification(
  input: TelegramNotificationInput,
): Promise<void> {
  if (!isTelegramEnabled()) return

  try {
    const chatIds = await listTenantChatIds(input.tenantId)
    if (chatIds.length === 0) return

    const text = formatMessage(input)
    for (const chatId of chatIds) {
      sendTelegramMessage(chatId, text)
    }
  } catch (err) {
    logger.error(
      { err, type: input.type, tenantId: input.tenantId },
      'Failed to dispatch Telegram notification',
    )
  }
}
