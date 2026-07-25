import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'

export const AUTH_COOKIE_NAME = 'token'

// Kept in step with JWT_EXPIRES_IN so the cookie never outlives the token it
// carries — otherwise the browser keeps sending a token the server will reject.
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24

// The frontend (Vercel) and the API (Railway) are different sites, so the auth
// cookie must be SameSite=None to be sent at all — which browsers only allow
// together with Secure. Every place that issues a session uses this, so the
// invite-join flow cannot drift back to SameSite=Lax and silently stop working.
const BASE_OPTIONS = {
  httpOnly: true,
  sameSite: 'None',
  secure: true,
  path: '/',
} as const

export function setAuthCookie(c: Context, token: string): void {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  })
}

// maxAge 0 expires the cookie immediately. Blanking the value alone leaves a
// cookie in place for its original lifetime.
export function clearAuthCookie(c: Context): void {
  setCookie(c, AUTH_COOKIE_NAME, '', { ...BASE_OPTIONS, maxAge: 0 })
}
