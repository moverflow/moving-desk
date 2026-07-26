import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    DATABASE_URL: 'postgresql://test',
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

const createFeedbackMock = vi.fn()
vi.mock('../services/feedback.service.js', () => ({
  createFeedback: (...a: unknown[]) => createFeedbackMock(...a),
}))

const { default: feedbackRouter } = await import('./feedback.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext, clearAuthContext } = await import('../test/authContext.js')

const app = new Hono().route('/feedback', feedbackRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'

async function authCookie(): Promise<string> {
  setAuthContext({ userId: USER_A, tenantId: TENANT_A, role: 'owner', plan: 'basic', crewId: null })
  const token = await signToken({ sub: USER_A, tenantId: TENANT_A, role: 'owner', plan: 'basic' })
  return `token=${token}`
}

async function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return await app.request('/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  createFeedbackMock.mockReset()
  clearAuthContext()
})

describe('POST /feedback', () => {
  it('AC1 — an authenticated submission is scoped to the caller\'s tenant and user', async () => {
    createFeedbackMock.mockResolvedValue({ id: 'feedback-1' })

    const res = await post(
      { message: 'The invoice PDF is missing the logo', pageUrl: '/invoices', severity: 'bug' },
      { cookie: await authCookie() },
    )

    expect(res.status).toBe(201)
    expect(createFeedbackMock).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      userId: USER_A,
      message: 'The invoice PDF is missing the logo',
      pageUrl: '/invoices',
      severity: 'bug',
    })
  })

  it('AC2 — an anonymous submission with no token is accepted with null tenant/user', async () => {
    createFeedbackMock.mockResolvedValue({ id: 'feedback-2' })

    const res = await post({ message: 'Love the guide page!', pageUrl: '/guide' })

    expect(res.status).toBe(201)
    expect(createFeedbackMock).toHaveBeenCalledWith({
      tenantId: null,
      userId: null,
      message: 'Love the guide page!',
      pageUrl: '/guide',
      severity: undefined,
    })
  })

  it('ignores a stale/invalid token rather than rejecting — treated as anonymous', async () => {
    createFeedbackMock.mockResolvedValue({ id: 'feedback-3' })

    const res = await post(
      { message: 'From a logged-out browser', pageUrl: '/book/best-movers' },
      { cookie: 'token=not-a-real-jwt' },
    )

    expect(res.status).toBe(201)
    expect(createFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null, userId: null }),
    )
  })

  it('rejects an empty message with 400', async () => {
    const res = await post({ message: '', pageUrl: '/orders' })

    expect(res.status).toBe(400)
    expect(createFeedbackMock).not.toHaveBeenCalled()
  })

  it('rejects a missing pageUrl with 400', async () => {
    const res = await post({ message: 'Something is broken' })

    expect(res.status).toBe(400)
    expect(createFeedbackMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid severity value with 400', async () => {
    const res = await post({ message: 'Something is broken', pageUrl: '/orders', severity: 'urgent' })

    expect(res.status).toBe(400)
    expect(createFeedbackMock).not.toHaveBeenCalled()
  })

  it('blocks a burst of submissions from one client IP with 429', async () => {
    createFeedbackMock.mockResolvedValue({ id: 'feedback-x' })

    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await post(
        { message: 'Spam-like burst', pageUrl: '/guide' },
        { 'x-envoy-external-address': '198.51.100.42' },
      )
      statuses.push(res.status)
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(201))
    expect(statuses.slice(10)).toEqual([429, 429])
    expect(createFeedbackMock).toHaveBeenCalledTimes(10)
  })
})
