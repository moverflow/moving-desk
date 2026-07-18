import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { z } from 'zod'
import { sendWelcomeEmail } from '../lib/email.js'
import { signToken } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  findUserByEmail,
  generateUniqueSlug,
  getMeData,
  loginUser,
  registerTenantAndUser,
} from '../services/auth.service.js'
import type { AppVariables, Plan, UserRole } from '../types/index.js'

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

// The token backing the current request — cookie first, Bearer header fallback
// (iOS Safari). Used so /auth/me can re-hand the token back to the client.
function getRequestToken(c: Context): string | null {
  const cookie = getCookie(c, 'token')
  if (cookie) return cookie
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return null
}

const auth = new Hono<{ Variables: AppVariables }>()

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
    sameSite: 'None',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: true,
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
      token: jwt,
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
    crewId: row.crew_id ?? undefined,
  })

  setCookie(c, 'token', jwt, {
    httpOnly: true,
    sameSite: 'None',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: true,
  })

  return c.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      crewId: row.crew_id ?? null,
      crewName: row.crewName ?? null,
    },
    tenant: {
      id: row.tenant_id,
      name: row.tenantName,
      plan: row.plan ?? 'trial',
    },
    token: jwt,
  })
})

auth.get('/me', authMiddleware, async (c) => {
  const data = await getMeData(c.get('userId'), c.get('tenantId'))
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json({
    user: {
      id: data.userId,
      email: data.userEmail,
      name: data.userName,
      role: data.userRole,
      crewId: data.userCrewId ?? null,
      crewName: data.userCrewName ?? null,
    },
    tenant: { id: data.tenantId, name: data.tenantName, plan: data.tenantPlan ?? 'trial' },
    token: getRequestToken(c),
  })
})

auth.post('/logout', authMiddleware, async (c) => {
  setCookie(c, 'token', '', {
    httpOnly: true,
    sameSite: 'None',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: true,
  })
  return c.json({ message: 'Logged out' })
})

export default auth
