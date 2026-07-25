import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { getClientIp, rateLimit } from './rateLimit.js'

function buildApp(options: { limit: number; windowMs: number; message?: string }) {
  const app = new Hono()
  app.post('/x', rateLimit(options), (c) => c.json({ ok: true }))
  return app
}

function from(ip: string | null, header = 'x-envoy-external-address'): RequestInit {
  return { method: 'POST', headers: ip === null ? {} : { [header]: ip } }
}

describe('getClientIp', () => {
  it('prefers x-envoy-external-address, which Railway/Envoy sets and clients cannot forge', async () => {
    const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))
    const res = await app.request('/ip', {
      headers: {
        'x-envoy-external-address': '198.51.100.7',
        'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      },
    })
    expect(await res.json()).toEqual({ ip: '198.51.100.7' })
  })

  it('falls back to the RIGHTMOST x-forwarded-for hop, the one the proxy appended', async () => {
    const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))
    const res = await app.request('/ip', {
      headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' },
    })
    expect(await res.json()).toEqual({ ip: '198.51.100.7' })
  })

  it('ignores a spoofed leftmost x-forwarded-for value', async () => {
    const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))
    const res = await app.request('/ip', {
      headers: { 'x-forwarded-for': 'not-a-real-ip, 198.51.100.7' },
    })
    const body = (await res.json()) as { ip: string }
    expect(body.ip).toBe('198.51.100.7')
    expect(body.ip).not.toBe('not-a-real-ip')
  })

  it('tolerates whitespace and a single-hop header', async () => {
    const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))
    const res = await app.request('/ip', { headers: { 'x-forwarded-for': '  198.51.100.7  ' } })
    expect(await res.json()).toEqual({ ip: '198.51.100.7' })
  })

  it('returns "unknown" when no proxy headers are present', async () => {
    const app = new Hono().get('/ip', (c) => c.json({ ip: getClientIp(c) }))
    const res = await app.request('/ip')
    expect(await res.json()).toEqual({ ip: 'unknown' })
  })
})

describe('rateLimit', () => {
  it('allows requests up to the limit, then rejects with 429', async () => {
    const app = buildApp({ limit: 3, windowMs: 60_000 })

    for (let i = 0; i < 3; i++) {
      const res = await app.request('/x', from('198.51.100.1'))
      expect(res.status).toBe(200)
    }

    const blocked = await app.request('/x', from('198.51.100.1'))
    expect(blocked.status).toBe(429)
  })

  it('keeps counting across many requests in one run (state persists)', async () => {
    const app = buildApp({ limit: 2, windowMs: 60_000 })
    const statuses: number[] = []

    for (let i = 0; i < 5; i++) {
      statuses.push((await app.request('/x', from('198.51.100.2'))).status)
    }

    expect(statuses).toEqual([200, 200, 429, 429, 429])
  })

  it('returns the configured message and a Retry-After header', async () => {
    const app = buildApp({ limit: 1, windowMs: 60_000, message: 'Slow down' })
    await app.request('/x', from('198.51.100.3'))

    const res = await app.request('/x', from('198.51.100.3'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Slow down' })
    const retryAfter = Number(res.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })

  it('buckets each client IP separately', async () => {
    const app = buildApp({ limit: 1, windowMs: 60_000 })

    expect((await app.request('/x', from('198.51.100.4'))).status).toBe(200)
    expect((await app.request('/x', from('198.51.100.4'))).status).toBe(429)
    // A different client is unaffected by the first one's spending.
    expect((await app.request('/x', from('198.51.100.5'))).status).toBe(200)
  })

  it('cannot be bypassed by forging the leftmost x-forwarded-for hop', async () => {
    const app = new Hono()
    app.post('/x', rateLimit({ limit: 1, windowMs: 60_000 }), (c) => c.json({ ok: true }))

    const first = await app.request('/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': 'spoof-1, 198.51.100.6' },
    })
    expect(first.status).toBe(200)

    // Same real client, different forged prefix — must still be rate limited.
    const second = await app.request('/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': 'spoof-2, 198.51.100.6' },
    })
    expect(second.status).toBe(429)
  })

  it('does not let a forged x-envoy-external-address split one client into many buckets', async () => {
    // Envoy overwrites this header at the edge, so in production a client
    // cannot set it. The limiter simply trusts whatever the proxy presents.
    const app = buildApp({ limit: 1, windowMs: 60_000 })
    expect((await app.request('/x', from('198.51.100.8'))).status).toBe(200)
    expect((await app.request('/x', from('198.51.100.8'))).status).toBe(429)
  })

  it('gives separate limiter instances independent state', async () => {
    const a = buildApp({ limit: 1, windowMs: 60_000 })
    const b = buildApp({ limit: 1, windowMs: 60_000 })

    expect((await a.request('/x', from('198.51.100.9'))).status).toBe(200)
    expect((await a.request('/x', from('198.51.100.9'))).status).toBe(429)
    // Same IP, different route/limiter — its own budget.
    expect((await b.request('/x', from('198.51.100.9'))).status).toBe(200)
  })

  describe('window expiry and eviction', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('lets the client through again once the window has passed', async () => {
      vi.setSystemTime(new Date('2026-07-25T12:00:00Z'))
      const app = buildApp({ limit: 1, windowMs: 60_000 })

      expect((await app.request('/x', from('198.51.100.10'))).status).toBe(200)
      expect((await app.request('/x', from('198.51.100.10'))).status).toBe(429)

      vi.setSystemTime(new Date('2026-07-25T12:01:01Z'))
      expect((await app.request('/x', from('198.51.100.10'))).status).toBe(200)
    })

    it('does not reset the window early', async () => {
      vi.setSystemTime(new Date('2026-07-25T12:00:00Z'))
      const app = buildApp({ limit: 1, windowMs: 60_000 })

      await app.request('/x', from('198.51.100.11'))
      vi.setSystemTime(new Date('2026-07-25T12:00:59Z'))
      expect((await app.request('/x', from('198.51.100.11'))).status).toBe(429)
    })

    it('evicts expired buckets instead of growing forever', async () => {
      vi.setSystemTime(new Date('2026-07-25T12:00:00Z'))
      const app = buildApp({ limit: 1, windowMs: 60_000 })

      for (let i = 0; i < 200; i++) {
        await app.request('/x', from(`198.51.100.${i}`))
      }

      // A full window later the sweep runs and every stale bucket is dropped,
      // so an IP seen before is treated as new rather than remembered forever.
      vi.setSystemTime(new Date('2026-07-25T12:02:00Z'))
      expect((await app.request('/x', from('198.51.100.0'))).status).toBe(200)
    })
  })
})
