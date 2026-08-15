import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'https://movingdesk.test',
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_BOT_USERNAME: 'movingdesk_test_bot',
    TELEGRAM_WEBHOOK_SECRET: 'secret',
    ANTHROPIC_API_KEY: 'test-key',
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

const telegramEnabled = { value: true }
vi.mock('../lib/telegram.js', () => ({
  isTelegramEnabled: () => telegramEnabled.value,
  getBot: () => null,
}))

const aiConfigured = { value: true }
vi.mock('../lib/anthropic.js', () => ({
  ASSISTANT_MODEL: 'claude-opus-5',
  isAIConfigured: () => aiConfigured.value,
  anthropic: { messages: { create: vi.fn() } },
}))

const startSessionMock = vi.fn()
const linkSessionMock = vi.fn()
vi.mock('../services/assistant-auth.service.js', () => ({
  startSession: (...a: unknown[]) => startSessionMock(...a),
  linkSession: (...a: unknown[]) => linkSessionMock(...a),
}))

const getTranscriptMock = vi.fn()
const sendMessageMock = vi.fn()
const resolveActionMock = vi.fn()
vi.mock('../services/assistant.service.js', async () => {
  class AssistantUnavailableError extends Error {
    constructor() {
      super('The assistant is not configured on this deployment.')
      this.name = 'AssistantUnavailableError'
    }
  }
  return {
    AssistantUnavailableError,
    getTranscript: (...a: unknown[]) => getTranscriptMock(...a),
    sendMessage: (...a: unknown[]) => sendMessageMock(...a),
    resolveAction: (...a: unknown[]) => resolveActionMock(...a),
  }
})

const { default: assistantRouter } = await import('./assistant.js')
const { AssistantUnavailableError } = await import('../services/assistant.service.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext, clearAuthContext } = await import('../test/authContext.js')

const app = new Hono<{ Variables: AppVariables }>().route('/assistant', assistantRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'
const TENANT_B = '99999999-9999-9999-9999-999999999999'
const USER_B = '88888888-8888-8888-8888-888888888888'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

async function authCookie(tenantId = TENANT_A, userId = USER_A): Promise<string> {
  setAuthContext({ userId, tenantId, role: 'dispatcher', plan: 'basic', crewId: null })
  const token = await signToken({ sub: userId, tenantId, role: 'dispatcher', plan: 'basic' })
  return `token=${token}`
}

// /session and /link share one rate-limit bucket per client IP, and the limiter
// lives for the module's lifetime. Each call gets a fresh address so one test's
// attempts cannot spend another's budget; the rate-limit test pins an address on
// purpose.
let clientIp = 0

async function post(path: string, body: unknown, cookie?: string, ip?: string): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-envoy-external-address': ip ?? `10.0.0.${++clientIp}`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

const EMPTY_VIEW = { messages: [], pendingAction: null }

beforeEach(() => {
  telegramEnabled.value = true
  aiConfigured.value = true
  clearAuthContext()
  vi.clearAllMocks()
  getTranscriptMock.mockResolvedValue(EMPTY_VIEW)
  sendMessageMock.mockResolvedValue(EMPTY_VIEW)
  resolveActionMock.mockResolvedValue({ status: 'ok', view: EMPTY_VIEW })
})

describe('GET /assistant/config', () => {
  it('reports enabled when both the bot and the API key are configured', async () => {
    const res = await app.request('/assistant/config')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: true })
  })

  it('reports disabled when the bot is not configured', async () => {
    telegramEnabled.value = false

    expect(await (await app.request('/assistant/config')).json()).toEqual({ enabled: false })
  })

  it('reports disabled when there is no API key', async () => {
    aiConfigured.value = false

    expect(await (await app.request('/assistant/config')).json()).toEqual({ enabled: false })
  })
})

describe('POST /assistant/session', () => {
  it('returns a token and the user for a linked Telegram account', async () => {
    startSessionMock.mockResolvedValue({
      status: 'ok',
      session: {
        token: 'jwt-here',
        user: { id: USER_A, name: 'Yuriy', role: 'owner' },
        company: 'Acme Movers',
      },
    })

    const res = await post('/assistant/session', { initData: 'user=%7B%7D&hash=abc' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      linked: true,
      token: 'jwt-here',
      user: { id: USER_A, name: 'Yuriy', role: 'owner' },
      company: 'Acme Movers',
    })
  })

  it('reports an unlinked account without issuing a token', async () => {
    startSessionMock.mockResolvedValue({ status: 'unlinked', telegramUserId: '987' })

    const res = await post('/assistant/session', { initData: 'x=1&hash=abc' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ linked: false })
  })

  // Unverified initData must never be answered with anything about accounts —
  // it is the one thing standing between a stranger and someone else's session.
  it('rejects initData that does not verify', async () => {
    startSessionMock.mockResolvedValue({ status: 'unverified' })

    const res = await post('/assistant/session', { initData: 'forged' })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Could not verify this Telegram session' })
  })

  it('rejects a body with no initData', async () => {
    const res = await post('/assistant/session', {})

    expect(res.status).toBe(400)
    expect(startSessionMock).not.toHaveBeenCalled()
  })

  it('rejects a non-JSON body', async () => {
    const res = await app.request('/assistant/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-envoy-external-address': `10.0.0.${++clientIp}`,
      },
      body: 'not json',
    })

    expect(res.status).toBe(400)
  })

  it('is unavailable when the bot is not configured', async () => {
    telegramEnabled.value = false

    const res = await post('/assistant/session', { initData: 'x=1' })

    expect(res.status).toBe(503)
    expect(startSessionMock).not.toHaveBeenCalled()
  })

  it('rate limits repeated attempts from one client', async () => {
    startSessionMock.mockResolvedValue({ status: 'unverified' })

    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await post('/assistant/session', { initData: `attempt-${i}` }, undefined, '10.9.9.9')
      statuses.push(res.status)
    }

    expect(statuses.slice(0, 10)).not.toContain(429)
    expect(statuses.slice(10)).toEqual([429, 429])
  })
})

describe('POST /assistant/link', () => {
  it('links with a valid code and returns a session', async () => {
    linkSessionMock.mockResolvedValue({
      status: 'ok',
      session: {
        token: 'jwt-here',
        user: { id: USER_A, name: 'Yuriy', role: 'owner' },
        company: 'Acme Movers',
      },
    })

    const res = await post('/assistant/link', { initData: 'x=1', code: 'ABCD2345' })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ linked: true, token: 'jwt-here' })
    expect(linkSessionMock).toHaveBeenCalledWith('x=1', 'ABCD2345')
  })

  it('reports an expired code separately from an invalid one', async () => {
    linkSessionMock.mockResolvedValue({ status: 'expired' })

    const res = await post('/assistant/link', { initData: 'x=1', code: 'ABCD2345' })

    expect(res.status).toBe(410)
  })

  it('rejects an invalid or already-used code', async () => {
    linkSessionMock.mockResolvedValue({ status: 'invalid' })

    const res = await post('/assistant/link', { initData: 'x=1', code: 'ABCD2345' })

    expect(res.status).toBe(400)
  })

  it('rejects unverified initData even when a code is supplied', async () => {
    linkSessionMock.mockResolvedValue({ status: 'unverified' })

    const res = await post('/assistant/link', { initData: 'forged', code: 'ABCD2345' })

    expect(res.status).toBe(401)
  })

  it('requires a code', async () => {
    const res = await post('/assistant/link', { initData: 'x=1' })

    expect(res.status).toBe(400)
    expect(linkSessionMock).not.toHaveBeenCalled()
  })
})

describe('GET /assistant/messages', () => {
  it('requires authentication', async () => {
    const res = await app.request('/assistant/messages')

    expect(res.status).toBe(401)
    expect(getTranscriptMock).not.toHaveBeenCalled()
  })

  it('returns the transcript for the authenticated user', async () => {
    const cookie = await authCookie()

    const res = await app.request('/assistant/messages', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(getTranscriptMock).toHaveBeenCalledWith(TENANT_A, USER_A)
  })

  // The tenant and user come from the verified token, never from the request, so
  // a second tenant's session can only ever read its own transcript.
  it('scopes the transcript to the caller tenant', async () => {
    const cookie = await authCookie(TENANT_B, USER_B)

    await app.request('/assistant/messages', { headers: { Cookie: cookie } })

    expect(getTranscriptMock).toHaveBeenCalledWith(TENANT_B, USER_B)
    expect(getTranscriptMock).not.toHaveBeenCalledWith(TENANT_A, USER_A)
  })
})

describe('POST /assistant/messages', () => {
  it('requires authentication', async () => {
    const res = await post('/assistant/messages', { text: 'hello' })

    expect(res.status).toBe(401)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('sends the message for the authenticated user', async () => {
    const cookie = await authCookie()

    const res = await post('/assistant/messages', { text: 'which invoices are unpaid?' }, cookie)

    expect(res.status).toBe(200)
    expect(sendMessageMock).toHaveBeenCalledWith(TENANT_A, USER_A, 'which invoices are unpaid?')
  })

  it('trims whitespace and rejects an empty message', async () => {
    const cookie = await authCookie()

    const res = await post('/assistant/messages', { text: '   ' }, cookie)

    expect(res.status).toBe(400)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('rejects a message past the length limit', async () => {
    const cookie = await authCookie()

    const res = await post('/assistant/messages', { text: 'x'.repeat(2001) }, cookie)

    expect(res.status).toBe(400)
  })

  it('answers 503 when the assistant is not configured', async () => {
    const cookie = await authCookie()
    sendMessageMock.mockRejectedValue(new AssistantUnavailableError())

    const res = await post('/assistant/messages', { text: 'hi' }, cookie)

    expect(res.status).toBe(503)
  })
})

describe('POST /assistant/actions', () => {
  it('requires authentication', async () => {
    const res = await post('/assistant/actions', {
      messageId: MESSAGE_ID,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(res.status).toBe(401)
    expect(resolveActionMock).not.toHaveBeenCalled()
  })

  it('confirms a pending action for the authenticated user', async () => {
    const cookie = await authCookie()

    const res = await post(
      '/assistant/actions',
      { messageId: MESSAGE_ID, toolUseId: 'toolu_1', decision: 'confirm' },
      cookie,
    )

    expect(res.status).toBe(200)
    expect(resolveActionMock).toHaveBeenCalledWith(TENANT_A, USER_A, {
      messageId: MESSAGE_ID,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })
  })

  it('rejects a decision that is neither confirm nor reject', async () => {
    const cookie = await authCookie()

    const res = await post(
      '/assistant/actions',
      { messageId: MESSAGE_ID, toolUseId: 'toolu_1', decision: 'maybe' },
      cookie,
    )

    expect(res.status).toBe(400)
    expect(resolveActionMock).not.toHaveBeenCalled()
  })

  it('rejects a messageId that is not a uuid', async () => {
    const cookie = await authCookie()

    const res = await post(
      '/assistant/actions',
      { messageId: 'nope', toolUseId: 'toolu_1', decision: 'confirm' },
      cookie,
    )

    expect(res.status).toBe(400)
  })

  // Double-tapping confirm must not create two jobs.
  it('answers 409 when the action was already resolved', async () => {
    const cookie = await authCookie()
    resolveActionMock.mockResolvedValue({ status: 'already_resolved' })

    const res = await post(
      '/assistant/actions',
      { messageId: MESSAGE_ID, toolUseId: 'toolu_1', decision: 'confirm' },
      cookie,
    )

    expect(res.status).toBe(409)
  })

  it('answers 404 when there is no such pending action', async () => {
    const cookie = await authCookie()
    resolveActionMock.mockResolvedValue({ status: 'not_found' })

    const res = await post(
      '/assistant/actions',
      { messageId: MESSAGE_ID, toolUseId: 'toolu_1', decision: 'confirm' },
      cookie,
    )

    expect(res.status).toBe(404)
  })

  it('scopes resolution to the caller tenant', async () => {
    const cookie = await authCookie(TENANT_B, USER_B)

    await post(
      '/assistant/actions',
      { messageId: MESSAGE_ID, toolUseId: 'toolu_1', decision: 'reject' },
      cookie,
    )

    expect(resolveActionMock).toHaveBeenCalledWith(TENANT_B, USER_B, expect.anything())
  })
})
