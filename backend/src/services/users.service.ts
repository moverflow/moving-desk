import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db'
import { invites, tenants, users } from '../db/schema'
import { signToken } from '../lib/jwt'
import type { Plan } from '../types'

export async function countUsersInTenant(tenantId: string): Promise<number> {
  const result = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(users)
    .where(eq(users.tenant_id, tenantId))
  return result[0]?.value ?? 0
}

export async function userExistsByEmail(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return rows.length > 0
}

export async function createInvite(tenantId: string, email: string) {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 48)

  const [invite] = await db
    .insert(invites)
    .values({ tenant_id: tenantId, email, expires_at: expiresAt })
    .returning()

  return invite
}

export async function findInviteByToken(token: string) {
  const rows = await db
    .select({
      id: invites.id,
      email: invites.email,
      tenant_id: invites.tenant_id,
      tenantName: tenants.name,
      tenantPlan: tenants.plan,
    })
    .from(invites)
    .innerJoin(tenants, eq(tenants.id, invites.tenant_id))
    .where(and(eq(invites.token, token), gt(invites.expires_at, new Date())))
    .limit(1)
  return rows[0] ?? null
}

export async function joinWithInvite(params: {
  inviteId: string
  inviteEmail: string
  tenantId: string
  tenantPlan: string | null
  name: string
  passwordHash: string
}) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        tenant_id: params.tenantId,
        email: params.inviteEmail,
        password_hash: params.passwordHash,
        role: 'dispatcher',
        name: params.name,
      })
      .returning()

    await tx.delete(invites).where(eq(invites.id, params.inviteId))

    const jwt = await signToken({
      sub: user.id,
      tenantId: params.tenantId,
      role: 'dispatcher',
      plan: (params.tenantPlan ?? 'trial') as Plan,
    })

    return { user, jwt }
  })
}
