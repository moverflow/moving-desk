import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

vi.mock('../lib/email.js', () => ({ sendWelcomeEmail: vi.fn() }))

const loginUserMock = vi.fn()
const recordLoginMock = vi.fn()
vi.mock('../services/auth.service.js', () => ({
  loginUser: (...a: unknown[]) => loginUserMock(...a),
  recordLogin: (...a: unknown[]) => recordLoginMock(...a),
  findUserByEmail: vi.fn(),
  generateUniqueSlug: vi.fn(),
  getMeData: vi.fn(),
  registerTenantAndUser: vi.fn(),
}))

const { default: authRouter } = await import('./auth.js')

const app = new Hono<{ Variables: AppVariables }>().route('/auth', authRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'
const CORRECT_PASSWORD = 'correct-password'

let validHash: string

beforeAll(async () => {
  // Low cost factor — this is a test fixture, not app.js's own bcrypt.hash(x, 12)
  // call, so it doesn't need production-strength cost; it just needs to be a real
  // hash bcrypt.compare can check against.
  validHash = await bcrypt.hash(CORRECT_PASSWORD, 4)
})

function activeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: USER_A,
    email: 'owner@bestmovers.com',
    name: 'Owner',
    role: 'owner',
    crew_id: null,
    crewName: null,
    password_hash: validHash,
    tenant_id: TENANT_A,
    tenantName: 'Best Movers',
    plan: 'basic',
    trial_ends_at: null,
    sub_status: 'active',
    ...overrides,
  }
}

async function postLogin(body: unknown, ip: string): Promise<Response> {
  return await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-envoy-external-address': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  loginUserMock.mockReset()
  recordLoginMock.mockReset()
})

describe('POST /auth/login — login tracking', () => {
  it('AC1/AC2 — records the login with the caller\'s ip on success', async () => {
    loginUserMock.mockResolvedValue(activeUserRow())

    const res = await postLogin(
      { email: 'owner@bestmovers.com', password: CORRECT_PASSWORD },
      '198.51.100.10',
    )

    expect(res.status).toBe(200)
    expect(recordLoginMock).toHaveBeenCalledWith(USER_A, TENANT_A, '198.51.100.10')
  })

  it('does not record a login for a wrong password', async () => {
    loginUserMock.mockResolvedValue(activeUserRow())

    const res = await postLogin({ email: 'owner@bestmovers.com', password: 'wrong' }, '198.51.100.11')

    expect(res.status).toBe(401)
    expect(recordLoginMock).not.toHaveBeenCalled()
  })

  it('does not record a login for an unknown email', async () => {
    loginUserMock.mockResolvedValue(null)

    const res = await postLogin(
      { email: 'nobody@example.com', password: CORRECT_PASSWORD },
      '198.51.100.12',
    )

    expect(res.status).toBe(401)
    expect(recordLoginMock).not.toHaveBeenCalled()
  })

  it('does not record a login for a suspended account, even with the correct password', async () => {
    loginUserMock.mockResolvedValue(
      activeUserRow({
        plan: 'trial',
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
        sub_status: null,
      }),
    )

    const res = await postLogin(
      { email: 'owner@bestmovers.com', password: CORRECT_PASSWORD },
      '198.51.100.13',
    )

    expect(res.status).toBe(403)
    expect(recordLoginMock).not.toHaveBeenCalled()
  })
})
