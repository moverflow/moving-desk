import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

vi.mock('../services/auth.service.js', async () => {
  const { getAuthContextMock } = await import('../test/authContext.js')
  return { getAuthContext: getAuthContextMock }
})

const listNotificationsMock = vi.fn()
const markNotificationReadMock = vi.fn()
const markAllNotificationsReadMock = vi.fn()
vi.mock('../services/notifications.service.js', () => ({
  listNotifications: (...a: unknown[]) => listNotificationsMock(...a),
  markNotificationRead: (...a: unknown[]) => markNotificationReadMock(...a),
  markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsReadMock(...a),
}))

const { default: notificationsRouter } = await import('./notifications.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext, clearAuthContext } = await import('../test/authContext.js')

const app = new Hono<{ Variables: AppVariables }>().route('/notifications', notificationsRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'
const TENANT_B = '99999999-9999-9999-9999-999999999999'
const USER_B = '88888888-8888-8888-8888-888888888888'
const NOTIFICATION_ID = '33333333-3333-4333-8333-333333333333'

async function authCookie(
  tenantId: string = TENANT_A,
  userId: string = USER_A,
): Promise<string> {
  setAuthContext({ userId, tenantId, role: 'owner', plan: 'basic', crewId: null })
  const token = await signToken({ sub: userId, tenantId, role: 'owner', plan: 'basic' })
  return `token=${token}`
}

const NOTIFICATION_ROW = {
  id: NOTIFICATION_ID,
  tenant_id: TENANT_A,
  type: 'invoice_paid',
  title: 'Invoice INV-1089 paid',
  body: '$480 received',
  related_type: 'invoice',
  related_id: '44444444-4444-4444-8444-444444444444',
  read_at: null,
  created_at: '2026-07-25T10:00:00.000Z',
}

beforeEach(() => {
  listNotificationsMock.mockReset()
  markNotificationReadMock.mockReset()
  markAllNotificationsReadMock.mockReset()
  clearAuthContext()
})

describe('GET /notifications', () => {
  it('AC1 — returns the tenant\'s notifications with an unread count', async () => {
    listNotificationsMock.mockResolvedValue({ notifications: [NOTIFICATION_ROW], unreadCount: 1 })

    const res = await app.request('/notifications', { headers: { cookie: await authCookie() } })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { notifications: unknown[]; unreadCount: number }
    expect(body.unreadCount).toBe(1)
    expect(body.notifications).toHaveLength(1)
  })

  it('AC2 — scopes the query to the tenant in the token, not anything client-supplied', async () => {
    listNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 0 })

    await app.request(`/notifications?tenantId=${TENANT_B}`, {
      headers: { cookie: await authCookie(TENANT_A) },
    })

    expect(listNotificationsMock).toHaveBeenCalledWith(TENANT_A, { limit: 20, offset: 0 })
  })

  it('AC2 — a second tenant\'s token reads only that tenant', async () => {
    listNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 0 })

    await app.request('/notifications', {
      headers: { cookie: await authCookie(TENANT_B, USER_B) },
    })

    expect(listNotificationsMock).toHaveBeenCalledWith(TENANT_B, { limit: 20, offset: 0 })
  })

  it('applies limit and offset for pagination', async () => {
    listNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 0 })

    await app.request('/notifications?limit=5&offset=10', {
      headers: { cookie: await authCookie() },
    })

    expect(listNotificationsMock).toHaveBeenCalledWith(TENANT_A, { limit: 5, offset: 10 })
  })

  it('rejects an out-of-range limit with 400', async () => {
    const res = await app.request('/notifications?limit=500', {
      headers: { cookie: await authCookie() },
    })

    expect(res.status).toBe(400)
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric offset with 400', async () => {
    const res = await app.request('/notifications?offset=abc', {
      headers: { cookie: await authCookie() },
    })

    expect(res.status).toBe(400)
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.request('/notifications')
    expect(res.status).toBe(401)
    expect(listNotificationsMock).not.toHaveBeenCalled()
  })
})

describe('POST /notifications/:id/read', () => {
  it('AC3 — marks the notification read', async () => {
    markNotificationReadMock.mockResolvedValue(true)

    const res = await app.request(`/notifications/${NOTIFICATION_ID}/read`, {
      method: 'POST',
      headers: { cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(markNotificationReadMock).toHaveBeenCalledWith(TENANT_A, NOTIFICATION_ID)
  })

  it('AC2 — 404 for a notification belonging to another tenant', async () => {
    markNotificationReadMock.mockResolvedValue(false)

    const res = await app.request(`/notifications/${NOTIFICATION_ID}/read`, {
      method: 'POST',
      headers: { cookie: await authCookie(TENANT_B, USER_B) },
    })

    expect(res.status).toBe(404)
    expect(markNotificationReadMock).toHaveBeenCalledWith(TENANT_B, NOTIFICATION_ID)
  })

  it('returns 404 for a malformed id instead of a database error', async () => {
    const res = await app.request('/notifications/not-a-uuid/read', {
      method: 'POST',
      headers: { cookie: await authCookie() },
    })

    expect(res.status).toBe(404)
    expect(markNotificationReadMock).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.request(`/notifications/${NOTIFICATION_ID}/read`, { method: 'POST' })
    expect(res.status).toBe(401)
    expect(markNotificationReadMock).not.toHaveBeenCalled()
  })
})

describe('POST /notifications/read-all', () => {
  it('AC3 — marks every unread notification read for the tenant', async () => {
    markAllNotificationsReadMock.mockResolvedValue(4)

    const res = await app.request('/notifications/read-all', {
      method: 'POST',
      headers: { cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 4 })
    expect(markAllNotificationsReadMock).toHaveBeenCalledWith(TENANT_A)
  })

  // read-all is registered before /:id/read; this proves the literal path is not
  // swallowed by the parameterised one.
  it('routes to read-all rather than treating "read-all" as an id', async () => {
    markAllNotificationsReadMock.mockResolvedValue(0)

    await app.request('/notifications/read-all', {
      method: 'POST',
      headers: { cookie: await authCookie() },
    })

    expect(markNotificationReadMock).not.toHaveBeenCalled()
  })

  it('returns 401 without a token', async () => {
    const res = await app.request('/notifications/read-all', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(markAllNotificationsReadMock).not.toHaveBeenCalled()
  })
})
