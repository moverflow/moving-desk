import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.service.js'
import type { AppVariables } from '../types/index.js'

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const notificationsRouter = new Hono<{ Variables: AppVariables }>()

notificationsRouter.get('/', authMiddleware, async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400)
  }

  const result = await listNotifications(c.get('tenantId'), parsed.data)
  return c.json(result)
})

notificationsRouter.post('/read-all', authMiddleware, async (c) => {
  const updated = await markAllNotificationsRead(c.get('tenantId'))
  return c.json({ updated })
})

notificationsRouter.post('/:id/read', authMiddleware, async (c) => {
  // Postgres rejects a malformed uuid with an error, which would surface as a
  // 500 — a bad id in the URL is a client mistake, so answer 404.
  const id = z.string().uuid().safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Notification not found' }, 404)

  const found = await markNotificationRead(c.get('tenantId'), id.data)
  if (!found) return c.json({ error: 'Notification not found' }, 404)
  return c.json({ success: true })
})

export default notificationsRouter
