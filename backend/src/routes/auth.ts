import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import { sendWelcomeEmail } from '../lib/email'
import { env } from '../lib/env'
import {
  findUserByEmail,
  generateUniqueSlug,
  registerTenantAndUser,
} from '../services/auth.service'

const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
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

export default auth
