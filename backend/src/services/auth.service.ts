import { eq } from 'drizzle-orm'
import { db } from '../db'
import { subscriptions, tenants, users } from '../db/schema'
import { signToken } from '../lib/jwt'

export function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function findUserByEmail(email: string) {
  return db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
}

export async function generateUniqueSlug(companyName: string): Promise<string> {
  const base = generateSlug(companyName)
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, base))
    .limit(1)
  if (existing.length === 0) return base
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export async function registerTenantAndUser(params: {
  companyName: string
  email: string
  passwordHash: string
  name: string
  slug: string
}) {
  return db.transaction(async (tx) => {
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: params.companyName,
        slug: params.slug,
        plan: 'trial',
        trial_ends_at: trialEndsAt,
      })
      .returning()

    const [user] = await tx
      .insert(users)
      .values({
        tenant_id: tenant.id,
        email: params.email,
        password_hash: params.passwordHash,
        role: 'owner',
        name: params.name,
      })
      .returning()

    await tx.insert(subscriptions).values({
      tenant_id: tenant.id,
      plan: 'trial',
      status: 'trialing',
    })

    const jwt = await signToken({
      sub: user.id,
      tenantId: tenant.id,
      role: 'owner',
      plan: 'trial',
    })

    return { tenant, user, jwt }
  })
}
