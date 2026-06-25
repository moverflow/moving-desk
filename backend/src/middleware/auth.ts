import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'
import { verifyToken } from '../lib/jwt.js'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, 'token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const payload = await verifyToken(token)
    c.set('userId', payload.sub)
    c.set('tenantId', payload.tenantId)
    c.set('role', payload.role)
    c.set('plan', payload.plan)
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}

export const requireOwner: MiddlewareHandler = async (c, next) => {
  if (c.get('role') !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

export const requireActiveSubscription: MiddlewareHandler = async (c, next) => {
  const tenantId = c.get('tenantId') as string
  const [sub] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.tenant_id, tenantId))
    .limit(1)

  if (!sub || sub.status === 'cancelled' || sub.status === 'past_due') {
    return c.json({ error: 'Subscription required' }, 402)
  }

  await next()
}
