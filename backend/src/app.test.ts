import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('./lib/env', () => ({
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
    SENTRY_DSN: '',
  },
}))

vi.mock('./lib/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('./db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}))

const captureErrorMock = vi.fn()
vi.mock('./lib/sentry.js', () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...args),
}))

const { default: app } = await import('./app.js')

// Routes that exist only to drive app.onError.
const boom = new Hono()
boom.get('/500', () => {
  throw new Error('duplicate key value violates unique constraint "clients_tenant_phone_idx"')
})
boom.get('/418', () => {
  const err = new Error('I am a teapot') as Error & { status: number }
  err.status = 418
  throw err
})
app.route('/__test', boom)

describe('GET /health', () => {
  it('returns 200 with status ok and ISO timestamp', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; timestamp: string }
    expect(body.status).toBe('ok')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('returns fresh timestamp on every call', async () => {
    const r1 = await app.request('/health')
    const r2 = await app.request('/health')
    const b1 = await r1.json() as { timestamp: string }
    const b2 = await r2.json() as { timestamp: string }
    expect(typeof b1.timestamp).toBe('string')
    expect(typeof b2.timestamp).toBe('string')
  })
})

describe('CORS', () => {
  it('sets Allow-Origin to FRONTEND_URL on requests from that origin', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('includes credentials header', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('preflight OPTIONS responds with CORS headers', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('does not echo back unknown origin as allowed', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://evil.example.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).not.toBe('http://evil.example.com')
  })
})

describe('404 for unknown routes', () => {
  it('returns 404 for routes that do not exist', async () => {
    const res = await app.request('/not-a-real-route')
    expect(res.status).toBe(404)
  })
})


describe('error handling', () => {
  beforeEach(() => {
    captureErrorMock.mockReset()
  })

  it('does not leak the raw exception message on a 500', async () => {
    const res = await app.request('/__test/500')

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string; requestId: string }
    expect(body.error).toBe('Something went wrong on our end.')
    expect(body.error).not.toContain('constraint')
    expect(body.error).not.toContain('clients_tenant_phone_idx')
  })

  it('returns a correlation id the client can quote back', async () => {
    const res = await app.request('/__test/500')

    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers.get('x-request-id')).toBe(body.requestId)
  })

  it('reports the 500 to Sentry with route and status context', async () => {
    await app.request('/__test/500')

    expect(captureErrorMock).toHaveBeenCalledTimes(1)
    const [err, context] = captureErrorMock.mock.calls[0] as [Error, Record<string, unknown>]
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('clients_tenant_phone_idx')
    expect(context.route).toBe('/__test/500')
    expect(context.method).toBe('GET')
    expect(context.statusCode).toBe(500)
    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses an inbound x-request-id so it correlates across services', async () => {
    const res = await app.request('/__test/500', {
      headers: { 'x-request-id': 'abc-123' },
    })

    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe('abc-123')
  })

  it('still passes a deliberate 4xx message through unchanged', async () => {
    const res = await app.request('/__test/418')

    expect(res.status).toBe(418)
    expect(await res.json()).toEqual({ error: 'I am a teapot', status: 418 })
  })

  it('does not report 4xx to Sentry', async () => {
    await app.request('/__test/418')
    expect(captureErrorMock).not.toHaveBeenCalled()
  })

  it('sets a request id on successful responses too', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  })
})
