import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import { sendInviteEmail } from '../lib/email'
import { env } from '../lib/env'
import { authMiddleware, requireOwner } from '../middleware/auth'
import type { AppVariables } from '../types'
import {
  countUsersInTenant,
  createInvite,
  findInviteByToken,
  joinWithInvite,
  userExistsByEmail,
} from '../services/users.service'

const PLAN_USER_LIMITS: Record<string, number> = { trial: 1, basic: 3, pro: 10 }

const inviteSchema = z.object({ email: z.string().email() })

const joinSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(2),
  password: z.string().min(8),
})

const usersRouter = new Hono<{ Variables: AppVariables }>()

usersRouter.post('/invite', authMiddleware, requireOwner, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid email' }, 400)
  }

  const result = inviteSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid email' }, 400)
  }

  const { email } = result.data
  const tenantId = c.get('tenantId') as string
  const plan = c.get('plan') as string

  const limit = PLAN_USER_LIMITS[plan] ?? 1
  const currentCount = await countUsersInTenant(tenantId)
  if (currentCount >= limit) {
    return c.json({ error: 'User limit reached' }, 422)
  }

  const exists = await userExistsByEmail(email)
  if (exists) {
    return c.json({ error: 'User already exists' }, 409)
  }

  const invite = await createInvite(tenantId, email)
  sendInviteEmail(email, invite.token)

  return c.json({ message: 'Invite sent', email }, 201)
})

usersRouter.post('/join', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }

  const result = joinSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed' }, 400)
  }

  const { token, name, password } = result.data

  const invite = await findInviteByToken(token)
  if (!invite) {
    return c.json({ error: 'Invalid or expired invite' }, 404)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const { user, jwt } = await joinWithInvite({
    inviteId: invite.id,
    inviteEmail: invite.email,
    tenantId: invite.tenant_id,
    tenantPlan: invite.tenantPlan,
    name,
    passwordHash,
  })

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
        id: invite.tenant_id,
        name: invite.tenantName,
        plan: invite.tenantPlan ?? 'trial',
      },
    },
    201
  )
})

export default usersRouter
