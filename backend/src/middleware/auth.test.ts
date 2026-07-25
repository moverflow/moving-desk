import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '1d',
    NODE_ENV: 'test',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({ db: {} }))

const getAuthContextMock = vi.fn()
vi.mock('../services/auth.service.js', () => ({
  getAuthContext: (...args: unknown[]) => getAuthContextMock(...args),
}))

const { authMiddleware } = await import('./auth.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>()
app.get('/protected', authMiddleware, (c) =>
  c.json({
    userId: c.get('userId'),
    tenantId: c.get('tenantId'),
    role: c.get('role'),
    plan: c.get('plan'),
    crewId: c.get('crewId'),
  }),
)

const TENANT = '11111111-1111-1111-1111-111111111111'
const OTHER_TENANT = '99999999-9999-9999-9999-999999999999'
const CREW = '22222222-2222-2222-2222-222222222222'

function account(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    tenantId: TENANT,
    role: 'crew',
    plan: 'basic',
    crewId: null,
    ...overrides,
  }
}

async function makeToken(claims: Record<string, unknown> = {}): Promise<string> {
  return signToken({
    sub: 'user-1',
    tenantId: TENANT,
    role: 'crew',
    plan: 'basic',
    ...claims,
  } as Parameters<typeof signToken>[0])
}

beforeEach(() => {
  vi.clearAllMocks()
  getAuthContextMock.mockResolvedValue(account())
})

describe('authMiddleware — dual auth (cookie + Bearer header)', () => {
  it('AC3 — authenticates via the httpOnly cookie', async () => {
    const res = await app.request('/protected', { headers: { cookie: `token=${await makeToken()}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'user-1' })
  })

  it('AC1/AC5 — authenticates via the Authorization: Bearer header when no cookie (iOS Safari)', async () => {
    getAuthContextMock.mockResolvedValue(account({ crewId: CREW }))
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${await makeToken({ crewId: CREW })}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'user-1', crewId: CREW })
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

describe('authMiddleware — revocation', () => {
  it('rejects a still-valid token once the account no longer exists', async () => {
    getAuthContextMock.mockResolvedValue(null)

    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken()}` },
    })

    expect(res.status).toBe(401)
  })

  it('rejects a removed account on the Bearer path too, not just the cookie', async () => {
    getAuthContextMock.mockResolvedValue(null)

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${await makeToken()}` },
    })

    expect(res.status).toBe(401)
  })

  it('looks the account up by the subject in the token', async () => {
    await app.request('/protected', { headers: { cookie: `token=${await makeToken()}` } })
    expect(getAuthContextMock).toHaveBeenCalledWith('user-1')
  })

  it('rejects a token issued for a different tenant than the account belongs to', async () => {
    getAuthContextMock.mockResolvedValue(account({ tenantId: TENANT }))

    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken({ tenantId: OTHER_TENANT })}` },
    })

    expect(res.status).toBe(401)
  })
})

describe('authMiddleware — live claims', () => {
  it('uses the current role, not the one baked into the token', async () => {
    getAuthContextMock.mockResolvedValue(account({ role: 'dispatcher' }))

    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken({ role: 'owner' })}` },
    })

    expect(await res.json()).toMatchObject({ role: 'dispatcher' })
  })

  it('reflects a plan upgrade immediately, without a new login', async () => {
    getAuthContextMock.mockResolvedValue(account({ plan: 'pro' }))

    // Token still says trial — the plan was upgraded after it was issued.
    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken({ plan: 'trial' })}` },
    })

    expect(await res.json()).toMatchObject({ plan: 'pro' })
  })

  it('uses the current crew assignment, not the token claim', async () => {
    getAuthContextMock.mockResolvedValue(account({ crewId: CREW }))

    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken()}` },
    })

    expect(await res.json()).toMatchObject({ crewId: CREW })
  })

  it('drops a crew assignment that has since been removed', async () => {
    getAuthContextMock.mockResolvedValue(account({ crewId: null }))

    const res = await app.request('/protected', {
      headers: { cookie: `token=${await makeToken({ crewId: CREW })}` },
    })

    expect(await res.json()).toMatchObject({ crewId: null })
  })
})
