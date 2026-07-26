import { db } from '../db/index.js'
import { feedback } from '../db/schema.js'
import { createNotification } from './notifications.service.js'
import type { FeedbackSeverity } from '../types/index.js'

export interface CreateFeedbackInput {
  tenantId: string | null
  userId: string | null
  message: string
  pageUrl: string
  severity?: FeedbackSeverity
}

const SEVERITY_LABEL: Record<FeedbackSeverity, string> = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  other: 'Feedback',
}

export async function createFeedback(input: CreateFeedbackInput): Promise<typeof feedback.$inferSelect> {
  const [row] = await db
    .insert(feedback)
    .values({
      tenant_id: input.tenantId,
      user_id: input.userId,
      message: input.message,
      page_url: input.pageUrl,
      severity: input.severity ?? null,
    })
    .returning()

  // Anonymous submissions with no resolved tenant (e.g. from /guide) have no
  // owner inbox to notify — only tenant-scoped submissions raise a bell alert.
  if (input.tenantId) {
    await createNotification({
      tenantId: input.tenantId,
      type: 'feedback_new',
      title: `${SEVERITY_LABEL[input.severity ?? 'other']} reported`,
      body: input.message.length > 200 ? `${input.message.slice(0, 200)}…` : input.message,
      relatedType: 'feedback',
      relatedId: row.id,
    })
  }

  return row
}
