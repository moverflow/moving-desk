import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_BOT_USERNAME: '',
    TELEGRAM_WEBHOOK_SECRET: '',
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

// The token is empty in this suite, so getBot() returns null and the webhook
// route is never mounted — that is exactly the "integration disabled" shape the
// acceptance criteria call for.
const enabled = { value: false }
vi.mock('../lib/telegram.js', () => ({
  isTelegramEnabled: () => enabled.value,
  getBot: () => null,
  telegramDeepLink: (code: string) => `https://t.me/bot?start=${code}`,
}))

const getTelegramStatusMock = vi.fn()
const createLinkCodeMock = vi.fn()
const unlinkTelegramMock = vi.fn()
vi.mock('../services/telegram.service.js', () => ({
  getTelegramStatus: (...a: unknown[]) => getTelegramStatusMock(...a),
  createLinkCode: (...a: unknown[]) => createLinkCodeMock(...a),
  unlinkTelegram: (...a: unknown[]) => unlinkTelegramMock(...a),
  handleStartCommand: vi.fn(),
}))

const { default: telegramRouter } = await import('./telegram.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext, clearAuthContext } = await import('../test/authContext.js')

const app = new Hono<{ Variables: AppVariables }>().route('/telegram', telegramRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'
const TENANT_B = '99999999-9999-9999-9999-999999999999'
const USER_B = '88888888-8888-8888-8888-888888888888'

async function authCookie(
  role: 'owner' | 'dispatcher' = 'owner',
  tenantId: string = TENANT_A,
  userId: string = USER_A,
): Promise<string> {
  setAuthContext({ userId, tenantId, role, plan: 'basic', crewId: null })
  const token = await signToken({ sub: userId, tenantId, role, plan: 'basic' })
  return `token=${token}`
}

beforeEach(() => {
  enabled.value = true
  clearAuthContext()
  getTelegramStatusMock.mockReset()
  createLinkCodeMock.mockReset()
  unlinkTelegramMock.mockReset()
  getTelegramStatusMock.mockResolvedValue({
    enabled: true,
    connected: false,
    botUsername: 'movingdesk_test_bot',
  })
  createLinkCodeMock.mockResolvedValue({
    code: 'ABCD2345',
    deepLink: 'https://t.me/movingdesk_test_bot?start=ABCD2345',
    expiresAt: new Date('2026-08-12T12:15:00.000Z'),
  })
  unlinkTelegramMock.mockResolvedValue(undefined)
})

describe('GET /telegram', () => {
  it('returns the connection status for the caller', async () => {
    const res = await app.request('/telegram', { headers: { Cookie: await authCookie() } })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      enabled: true,
      connected: false,
      botUsername: 'movingdesk_test_bot',
    })
  })

  it('scopes the lookup to the caller\'s own tenant and user', async () => {
    await app.request('/telegram', {
      headers: { Cookie: await authCookie('owner', TENANT_B, USER_B) },
    })

    expect(getTelegramStatusMock).toHaveBeenCalledWith(TENANT_B, USER_B)
  })

  it('rejects an unauthenticated caller', async () => {
    const res = await app.request('/telegram')

    expect(res.status).toBe(401)
    expect(getTelegramStatusMock).not.toHaveBeenCalled()
  })

  it('rejects a dispatcher', async () => {
    const res = await app.request('/telegram', {
      headers: { Cookie: await authCookie('dispatcher') },
    })

    expect(res.status).toBe(403)
    expect(getTelegramStatusMock).not.toHaveBeenCalled()
  })
})

describe('POST /telegram/link-code', () => {
  it('returns a code and deep link for the caller', async () => {
    const res = await app.request('/telegram/link-code', {
      method: 'POST',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      code: 'ABCD2345',
      deepLink: 'https://t.me/movingdesk_test_bot?start=ABCD2345',
      expiresAt: '2026-08-12T12:15:00.000Z',
    })
    expect(createLinkCodeMock).toHaveBeenCalledWith(TENANT_A, USER_A)
  })

  it('issues the code against the caller\'s tenant, never another', async () => {
    await app.request('/telegram/link-code', {
      method: 'POST',
      headers: { Cookie: await authCookie('owner', TENANT_B, USER_B) },
    })

    expect(createLinkCodeMock).toHaveBeenCalledWith(TENANT_B, USER_B)
  })

  it('answers 503 when no bot is configured', async () => {
    enabled.value = false

    const res = await app.request('/telegram/link-code', {
      method: 'POST',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(503)
    expect(createLinkCodeMock).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller', async () => {
    const res = await app.request('/telegram/link-code', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(createLinkCodeMock).not.toHaveBeenCalled()
  })

  it('rejects a dispatcher', async () => {
    const res = await app.request('/telegram/link-code', {
      method: 'POST',
      headers: { Cookie: await authCookie('dispatcher') },
    })

    expect(res.status).toBe(403)
    expect(createLinkCodeMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /telegram', () => {
  it('unlinks the caller\'s own account', async () => {
    const res = await app.request('/telegram', {
      method: 'DELETE',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(unlinkTelegramMock).toHaveBeenCalledWith(TENANT_A, USER_A)
  })

  it('rejects an unauthenticated caller', async () => {
    const res = await app.request('/telegram', { method: 'DELETE' })

    expect(res.status).toBe(401)
    expect(unlinkTelegramMock).not.toHaveBeenCalled()
  })

  it('rejects a dispatcher', async () => {
    const res = await app.request('/telegram', {
      method: 'DELETE',
      headers: { Cookie: await authCookie('dispatcher') },
    })

    expect(res.status).toBe(403)
    expect(unlinkTelegramMock).not.toHaveBeenCalled()
  })
})

describe('POST /telegram/webhook', () => {
  it('is not mounted at all when no bot is configured', async () => {
    const res = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    })

    expect(res.status).toBe(404)
  })
})
