import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'
import { verifyToken } from '../lib/jwt.js'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Primary: httpOnly cookie (secure, works everywhere except iOS Safari
  // cross-domain). Fallback: Bearer token from localStorage, sent as an
  // Authorization header — needed because iOS Safari ITP drops the cookie.
  let token = getCookie(c, 'token')
  if (!token) {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
  }
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const payload = await verifyToken(token)
    c.set('userId', payload.sub)
    c.set('tenantId', payload.tenantId)
    c.set('role', payload.role)
    c.set('plan', payload.plan)
    c.set('crewId', payload.crewId ?? null)
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

// Crew-only guard for the mobile PWA endpoints. Owners/dispatchers use the full
// desktop app and are rejected here (AC6/AC19) — the crew screen is scoped to a
// single crew's own jobs via the crewId carried in the JWT.
export const requireCrew: MiddlewareHandler = async (c, next) => {
  if (c.get('role') !== 'crew') {
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
