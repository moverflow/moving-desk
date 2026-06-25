import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import { sendWelcomeEmail } from '../lib/email.js'
import { env } from '../lib/env.js'
import { signToken } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  findUserByEmail,
  generateUniqueSlug,
  loginUser,
  registerTenantAndUser,
} from '../services/auth.service.js'
import type { Plan, UserRole } from '../types/index.js'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const auth = new Hono()

auth.post('/register', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed', details: [{ message: 'Invalid JSON body' }] }, 400)
  }

  const result = registerSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  const { companyName, email, password, name } = result.data

  const existing = await findUserByEmail(email)
  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const slug = await generateUniqueSlug(companyName)
  const passwordHash = await bcrypt.hash(password, 12)

  const { tenant, user, jwt } = await registerTenantAndUser({
    companyName,
    email,
    passwordHash,
    name,
    slug,
  })

  sendWelcomeEmail(email, name)

  setCookie(c, 'token', jwt, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: env.NODE_ENV === 'production',
  })

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan ?? 'trial',
        trialEndsAt: tenant.trial_ends_at!.toISOString(),
      },
    },
    201
  )
})

auth.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return c.json({ error: 'Too many attempts' }, 429)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }

  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed' }, 400)
  }

  const { email, password } = result.data

  const row = await loginUser(email)
  if (!row) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const isTrialActive =
    row.plan === 'trial' &&
    row.trial_ends_at !== null &&
    new Date(row.trial_ends_at) > new Date()
  const isSubscribed = row.sub_status === 'active'
  if (!isTrialActive && !isSubscribed) {
    return c.json({ error: 'Account suspended' }, 403)
  }

  const jwt = await signToken({
    sub: row.id,
    tenantId: row.tenant_id,
    role: row.role as UserRole,
    plan: (row.plan ?? 'trial') as Plan,
  })

  setCookie(c, 'token', jwt, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: env.NODE_ENV === 'production',
  })

  return c.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
    },
    tenant: {
      id: row.tenant_id,
      name: row.tenantName,
      plan: row.plan ?? 'trial',
    },
  })
})

auth.post('/logout', authMiddleware, async (c) => {
  setCookie(c, 'token', '', {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
    secure: env.NODE_ENV === 'production',
  })
  return c.json({ message: 'Logged out' })
})

export default auth
