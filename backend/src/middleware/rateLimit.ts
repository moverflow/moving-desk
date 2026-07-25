import type { Context, MiddlewareHandler } from 'hono'

// Railway fronts every service with an Envoy-based edge proxy. Envoy sets
// x-envoy-external-address to the trusted client address for external requests
// and does not honour a client-supplied value, so it is the one header here we
// can key on safely.
//
// x-forwarded-for is the fallback: a client can prefill it, but Envoy APPENDS
// the real downstream address to the right-hand end, so the RIGHTMOST entry is
// the one the trusted proxy wrote. The leftmost entry is attacker-controlled.
export function getClientIp(c: Context): string {
  const envoy = c.req.header('x-envoy-external-address')?.trim()
  if (envoy) return envoy

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean)
    const trusted = hops[hops.length - 1]
    if (trusted) return trusted
  }

  return 'unknown'
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  message?: string
}

interface Bucket {
  count: number
  resetAt: number
}

// Beyond this many tracked IPs in a single window we shed the entries closest
// to expiry. Reaching it means a distributed flood, which a per-IP limiter
// cannot stop anyway — the cap is here so memory stays bounded.
const MAX_TRACKED_IPS = 10_000

// Each rateLimit() call gets its own store, so routes never share a counter and
// a test can build an isolated limiter.
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { limit, windowMs, message = 'Too many requests. Please try again later.' } = options
  const buckets = new Map<string, Bucket>()
  let lastSweep = 0

  function sweep(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
    lastSweep = now
  }

  function evictOldest(): void {
    const byExpiry = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    for (const [key] of byExpiry.slice(0, Math.ceil(byExpiry.length / 2))) {
      buckets.delete(key)
    }
  }

  return async (c, next) => {
    const now = Date.now()

    // Amortised cleanup: every entry carries a TTL, so one pass per window
    // clears everything stale without walking the map on each request.
    if (now - lastSweep >= windowMs) sweep(now)
    if (buckets.size >= MAX_TRACKED_IPS) {
      sweep(now)
      if (buckets.size >= MAX_TRACKED_IPS) evictOldest()
    }

    const key = getClientIp(c)
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: message }, 429)
    }

    bucket.count++
    await next()
  }
}
