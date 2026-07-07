import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
    JWT_EXPIRES_IN: '7d',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    STRIPE_BASIC_PRICE_ID: 'price_basic',
    STRIPE_PRO_PRICE_ID: 'price_pro',
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY_ID: 'test-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://pub.example.com',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}))

const getSummaryMock = vi.fn()
const getOrdersByStatusMock = vi.fn()
const getOrdersByWeekMock = vi.fn()
const getTopCrewsMock = vi.fn()

vi.mock('../services/dashboard.service.js', () => ({
  getSummary: (...args: unknown[]) => getSummaryMock(...args),
  getOrdersByStatus: (...args: unknown[]) => getOrdersByStatusMock(...args),
  getOrdersByWeek: (...args: unknown[]) => getOrdersByWeekMock(...args),
  getTopCrews: (...args: unknown[]) => getTopCrewsMock(...args),
}))

const { default: dashboardRouter } = await import('./dashboard.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/dashboard', dashboardRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'

async function authCookie(role: 'owner' | 'dispatcher' = 'owner', tenantId = TENANT_A): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId, role, plan: 'trial' })
  return `token=${token}`
}

const summary = {
  totalOrders: 24,
  completedOrders: 20,
  cancelledOrders: 1,
  totalRevenue: 11520,
  avgOrderValue: 576,
}
const ordersByStatus = [{ status: 'completed', count: 20, revenue: 11520 }]
const ordersByWeek = [{ week: 'Jun 30', orders: 5, revenue: 2400 }]
const topCrews = [{ crewName: 'Crew A', truckLabel: 'Truck 1', ordersCount: 10, revenue: 5760 }]

beforeEach(() => {
  getSummaryMock.mockReset().mockResolvedValue(summary)
  getOrdersByStatusMock.mockReset().mockResolvedValue(ordersByStatus)
  getOrdersByWeekMock.mockReset().mockResolvedValue(ordersByWeek)
  getTopCrewsMock.mockReset().mockResolvedValue(topCrews)
})

describe('GET /dashboard', () => {
  it('returns 200 with the full expected shape for an owner — happy path', async () => {
    const res = await app.request('/dashboard', { headers: { Cookie: await authCookie('owner') } })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      period: string
      summary: typeof summary
      ordersByStatus: typeof ordersByStatus
      ordersByWeek: typeof ordersByWeek
      topCrews: typeof topCrews
    }
    expect(body).toEqual({ period: 'month', summary, ordersByStatus, ordersByWeek, topCrews })
  })

  it('defaults to period=month when no query param is given', async () => {
    await app.request('/dashboard', { headers: { Cookie: await authCookie('owner') } })
    expect(getSummaryMock).toHaveBeenCalledWith(TENANT_A, 'month')
    expect(getOrdersByStatusMock).toHaveBeenCalledWith(TENANT_A, 'month')
    expect(getTopCrewsMock).toHaveBeenCalledWith(TENANT_A, 'month')
  })

  it('passes through a valid period=week to the services and echoes it in the response', async () => {
    const res = await app.request('/dashboard?period=week', { headers: { Cookie: await authCookie('owner') } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { period: string }
    expect(body.period).toBe('week')
    expect(getSummaryMock).toHaveBeenCalledWith(TENANT_A, 'week')
  })

  it('always scopes service calls to the tenantId from the JWT', async () => {
    const otherTenant = '99999999-9999-9999-9999-999999999999'
    await app.request('/dashboard', { headers: { Cookie: await authCookie('owner', otherTenant) } })
    expect(getSummaryMock).toHaveBeenCalledWith(otherTenant, 'month')
  })

  it('rejects an invalid period value with 400', async () => {
    const res = await app.request('/dashboard?period=year', { headers: { Cookie: await authCookie('owner') } })
    expect(res.status).toBe(400)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request('/dashboard')
    expect(res.status).toBe(401)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })

  it('rejects a request with an invalid token with 401', async () => {
    const res = await app.request('/dashboard', { headers: { Cookie: 'token=not-a-real-jwt' } })
    expect(res.status).toBe(401)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })

  it('rejects a dispatcher with 403', async () => {
    const res = await app.request('/dashboard', { headers: { Cookie: await authCookie('dispatcher') } })
    expect(res.status).toBe(403)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })
})
