import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyToken } from '../lib/jwt'

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
