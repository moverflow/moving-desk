import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { subscriptions, tenants, users } from '../db/schema.js'
import { signToken } from '../lib/jwt.js'
import { logger } from '../lib/logger.js'
import { stripe } from '../lib/stripe.js'

export async function loginUser(email: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      password_hash: users.password_hash,
      tenant_id: users.tenant_id,
      tenantName: tenants.name,
      plan: tenants.plan,
      trial_ends_at: tenants.trial_ends_at,
      sub_status: subscriptions.status,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenant_id))
    .leftJoin(subscriptions, eq(subscriptions.tenant_id, tenants.id))
    .where(eq(users.email, email))
    .limit(1)
  return rows[0] ?? null
}

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
  const result = await db.transaction(async (tx) => {
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

  // Create Stripe customer after DB transaction — non-blocking, failure doesn't abort registration
  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.companyName,
    })
    await db
      .update(subscriptions)
      .set({ stripe_customer_id: customer.id })
      .where(eq(subscriptions.tenant_id, result.tenant.id))
  } catch (err) {
    logger.error({ err }, 'Failed to create Stripe customer on register')
  }

  return result
}

export async function getMeData(userId: string, tenantId: string) {
  const rows = await db
    .select({
      userId: users.id,
      userEmail: users.email,
      userName: users.name,
      userRole: users.role,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantPlan: tenants.plan,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenant_id))
    .where(and(eq(users.id, userId), eq(users.tenant_id, tenantId)))
    .limit(1)
  return rows[0] ?? null
}
