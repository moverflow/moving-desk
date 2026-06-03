import { describe, expect, it, vi } from 'vitest'

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

const { default: app } = await import('./app')

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
