import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { z } from 'zod'
import { clearAuthCookie, setAuthCookie } from '../lib/authCookie.js'
import { sendWelcomeEmail } from '../lib/email.js'
import { signToken } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import { getClientIp, rateLimit } from '../middleware/rateLimit.js'
import {
  findUserByEmail,
  generateUniqueSlug,
  getMeData,
  loginUser,
  recordLogin,
  registerTenantAndUser,
} from '../services/auth.service.js'
import type { AppVariables, Plan, UserRole } from '../types/index.js'

const loginRateLimit = rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many attempts',
})

// Registration creates a tenant, a user, a subscription row and sends mail, so
// legitimate use is rare — a much tighter limit than login is appropriate.
const registerRateLimit = rateLimit({
  limit: 3,
  windowMs: 60 * 60 * 1000,
  message: 'Too many registration attempts. Please try again later.',
})

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

const auth = new Hono<{ Variables: AppVariables }>()

auth.post('/register', registerRateLimit, async (c) => {
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

  setAuthCookie(c, jwt)

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

auth.post('/login', loginRateLimit, async (c) => {
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

  // Only reached once every gate above has passed — a suspended account never
  // gets here, so it never counts as a login even though the password matched.
  await recordLogin(row.id, row.tenant_id, getClientIp(c))

  setAuthCookie(c, jwt)

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

  // Sliding session: the app calls /me on load, so re-issuing here keeps an
  // active user signed in despite the now much shorter token lifetime. Safe
  // because authMiddleware re-checks the account on every request, so a longer
  // effective session no longer means a longer window of stale authorisation.
  const jwt = await signToken({
    sub: data.userId,
    tenantId: data.tenantId,
    role: data.userRole as UserRole,
    plan: (data.tenantPlan ?? 'trial') as Plan,
    crewId: data.userCrewId ?? undefined,
  })
  setAuthCookie(c, jwt)

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
    token: jwt,
  })
})

auth.post('/logout', authMiddleware, async (c) => {
  clearAuthCookie(c)
  return c.json({ message: 'Logged out' })
})

export default auth
