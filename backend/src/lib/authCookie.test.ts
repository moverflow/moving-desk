import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { clearAuthCookie, setAuthCookie } from './authCookie.js'

const app = new Hono()
app.get('/set', (c) => {
  setAuthCookie(c, 'jwt-value')
  return c.json({})
})
app.get('/clear', (c) => {
  clearAuthCookie(c)
  return c.json({})
})

async function setCookieHeader(path: string): Promise<string> {
  const res = await app.request(path)
  return res.headers.get('set-cookie') ?? ''
}

describe('setAuthCookie', () => {
  it('sets the token value', async () => {
    expect(await setCookieHeader('/set')).toContain('token=jwt-value')
  })

  it('is httpOnly so page scripts cannot read it', async () => {
    expect(await setCookieHeader('/set')).toMatch(/HttpOnly/i)
  })

  it('uses SameSite=None with Secure, required for the cross-site Vercel → Railway setup', async () => {
    const header = await setCookieHeader('/set')
    expect(header).toMatch(/SameSite=None/i)
    expect(header).toMatch(/Secure/i)
  })

  it('expires in a day, matching the token lifetime', async () => {
    expect(await setCookieHeader('/set')).toContain('Max-Age=86400')
  })
})

describe('clearAuthCookie', () => {
  it('expires the cookie immediately rather than only blanking it', async () => {
    const header = await setCookieHeader('/clear')
    expect(header).toContain('Max-Age=0')
    expect(header).not.toContain('Max-Age=86400')
  })

  it('keeps the same attributes so the browser matches and replaces the original cookie', async () => {
    const header = await setCookieHeader('/clear')
    expect(header).toMatch(/SameSite=None/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toContain('Path=/')
  })
})
