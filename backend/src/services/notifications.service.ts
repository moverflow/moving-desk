import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { notifications } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import type { NotificationRelatedType, NotificationType } from '../types/index.js'

export interface CreateNotificationInput {
  tenantId: string
  type: NotificationType
  title: string
  body?: string | null
  relatedType?: NotificationRelatedType | null
  relatedId?: string | null
}

// Notifications are a side channel: a booking must still be created, a payment
// must still be recorded, and a Stripe webhook must still return 200 even if
// this insert fails. Every failure is logged and swallowed — callers never see
// a rejection, so `void`-calling this is safe.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      tenant_id: input.tenantId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      related_type: input.relatedType ?? null,
      related_id: input.relatedId ?? null,
    })
  } catch (err) {
    logger.error({ err, type: input.type, tenantId: input.tenantId }, 'Failed to create notification')
  }
}

// Same guarantees as createNotification, plus: skips if one already exists for
// this (tenant, type, related record). Used by the daily reminder job, which
// re-examines the same order every run until its email actually goes out.
export async function createNotificationOnce(
  input: CreateNotificationInput & { relatedId: string },
): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenant_id, input.tenantId),
          eq(notifications.type, input.type),
          eq(notifications.related_id, input.relatedId),
        ),
      )
      .limit(1)
    if (existing) return
  } catch (err) {
    logger.error({ err, type: input.type, tenantId: input.tenantId }, 'Failed to check notification')
    return
  }

  await createNotification(input)
}

export interface ListNotificationsResult {
  notifications: Array<typeof notifications.$inferSelect>
  unreadCount: number
}

export async function listNotifications(
  tenantId: string,
  page: { limit: number; offset: number },
): Promise<ListNotificationsResult> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.tenant_id, tenantId))
    .orderBy(desc(notifications.created_at))
    .limit(page.limit)
    .offset(page.offset)

  // Counted across the whole tenant, not just this page — the bell badge has to
  // reflect everything unread, including rows past the end of the list.
  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.tenant_id, tenantId), isNull(notifications.read_at)))

  return { notifications: rows, unreadCount: unread?.value ?? 0 }
}

export async function markNotificationRead(tenantId: string, id: string): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.tenant_id, tenantId),
        isNull(notifications.read_at),
      ),
    )
    .returning({ id: notifications.id })

  if (updated) return true

  // Already read is a success for the caller — only a row belonging to another
  // tenant (or no row at all) is a miss.
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.tenant_id, tenantId)))
    .limit(1)

  return existing !== undefined
}

export async function markAllNotificationsRead(tenantId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(and(eq(notifications.tenant_id, tenantId), isNull(notifications.read_at)))
    .returning({ id: notifications.id })

  return updated.length
}
