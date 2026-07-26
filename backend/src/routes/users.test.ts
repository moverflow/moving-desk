import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables, Plan } from '../types/index.js'

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

const sendInviteEmailMock = vi.fn()
vi.mock('../lib/email.js', () => ({ sendInviteEmail: (...a: unknown[]) => sendInviteEmailMock(...a) }))

vi.mock('../services/auth.service.js', async () => {
  const { getAuthContextMock } = await import('../test/authContext.js')
  return { getAuthContext: getAuthContextMock }
})

const countUsersInTenantMock = vi.fn()
const userExistsByEmailMock = vi.fn()
const crewExistsForTenantMock = vi.fn()
const createInviteMock = vi.fn()

vi.mock('../services/users.service.js', () => ({
  countUsersInTenant: (...a: unknown[]) => countUsersInTenantMock(...a),
  createInvite: (...a: unknown[]) => createInviteMock(...a),
  crewExistsForTenant: (...a: unknown[]) => crewExistsForTenantMock(...a),
  findInviteByToken: vi.fn(),
  joinWithInvite: vi.fn(),
  listTeam: vi.fn(),
  removeUser: vi.fn(),
  userExistsByEmail: (...a: unknown[]) => userExistsByEmailMock(...a),
}))

const { default: usersRouter } = await import('./users.js')
const { signToken } = await import('../lib/jwt.js')
const { setAuthContext } = await import('../test/authContext.js')

const app = new Hono<{ Variables: AppVariables }>().route('/users', usersRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'

async function authCookie(plan: Plan = 'basic'): Promise<string> {
  setAuthContext({ userId: 'owner-1', tenantId: TENANT_A, role: 'owner', plan, crewId: null })
  const token = await signToken({ sub: 'owner-1', tenantId: TENANT_A, role: 'owner', plan })
  return `token=${token}`
}

beforeEach(() => {
  sendInviteEmailMock.mockReset()
  countUsersInTenantMock.mockReset().mockResolvedValue(1)
  userExistsByEmailMock.mockReset().mockResolvedValue(false)
  crewExistsForTenantMock.mockReset().mockResolvedValue(true)
  createInviteMock.mockReset()
})

describe('POST /users/invite', () => {
  // The whole point of this task: the token must come back in the response so
  // the owner can copy the join link themselves, not only rely on the email.
  it('returns the invite token in the response, alongside sending the email', async () => {
    createInviteMock.mockResolvedValue({
      id: 'invite-1', token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', email: 'dispatcher@example.com',
    })

    const res = await app.request('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ email: 'dispatcher@example.com' }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      message: 'Invite sent',
      email: 'dispatcher@example.com',
      token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    })
    expect(sendInviteEmailMock).toHaveBeenCalledWith('dispatcher@example.com', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('returns 422 when the plan is at its user limit', async () => {
    countUsersInTenantMock.mockResolvedValue(3)

    const res = await app.request('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie('basic') },
      body: JSON.stringify({ email: 'dispatcher@example.com' }),
    })

    expect(res.status).toBe(422)
    expect(createInviteMock).not.toHaveBeenCalled()
  })

  it('returns 409 when a user with that email already exists', async () => {
    userExistsByEmailMock.mockResolvedValue(true)

    const res = await app.request('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ email: 'dispatcher@example.com' }),
    })

    expect(res.status).toBe(409)
    expect(createInviteMock).not.toHaveBeenCalled()
  })

  it('requires crewId for a crew invite', async () => {
    const res = await app.request('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await authCookie() },
      body: JSON.stringify({ email: 'crew@example.com', role: 'crew' }),
    })

    expect(res.status).toBe(400)
    expect(createInviteMock).not.toHaveBeenCalled()
  })

  it('requires auth', async () => {
    const res = await app.request('/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dispatcher@example.com' }),
    })
    expect(res.status).toBe(401)
    expect(createInviteMock).not.toHaveBeenCalled()
  })
})
