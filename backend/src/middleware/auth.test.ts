import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ db: {} }))

const { authMiddleware } = await import('./auth.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>()
app.get('/protected', authMiddleware, (c) => c.json({ userId: c.get('userId'), crewId: c.get('crewId') }))

const TENANT = '11111111-1111-1111-1111-111111111111'
const CREW = '22222222-2222-2222-2222-222222222222'

async function makeToken(crewId?: string): Promise<string> {
  return signToken({ sub: 'user-1', tenantId: TENANT, role: 'crew', plan: 'basic', crewId })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authMiddleware — dual auth (cookie + Bearer header)', () => {
  it('AC3 — authenticates via the httpOnly cookie', async () => {
    const res = await app.request('/protected', { headers: { cookie: `token=${await makeToken()}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'user-1' })
  })

  it('AC1/AC5 — authenticates via the Authorization: Bearer header when no cookie (iOS Safari)', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${await makeToken(CREW)}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'user-1', crewId: CREW })
  })

  it('returns 401 when neither cookie nor header is present', async () => {
    const res = await app.request('/protected')
    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid Bearer token', async () => {
    const res = await app.request('/protected', { headers: { Authorization: 'Bearer not-a-jwt' } })
    expect(res.status).toBe(401)
  })

  it('prefers the cookie over the header (cookie is primary)', async () => {
    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken()}`, Authorization: 'Bearer garbage' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'user-1' })
  })
})
