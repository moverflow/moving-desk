import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { subscriptions, tenants } from '../db/schema'
import { env } from '../lib/env'
import { stripe } from '../lib/stripe'

function getPlanFromPriceId(priceId: string): string {
  if (priceId === env.STRIPE_BASIC_PRICE_ID) return 'basic'
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro'
  return 'basic'
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const map: Partial<Record<Stripe.Subscription.Status, string>> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'past_due',
    incomplete: 'trialing',
    incomplete_expired: 'cancelled',
    paused: 'past_due',
  }
  return map[status] ?? 'trialing'
}

function toCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === 'string' ? customer : customer.id
}

export async function getStripeCustomerId(tenantId: string): Promise<string | null> {
  const [sub] = await db
    .select({ stripe_customer_id: subscriptions.stripe_customer_id })
    .from(subscriptions)
    .where(eq(subscriptions.tenant_id, tenantId))
    .limit(1)
  return sub?.stripe_customer_id ?? null
}

export async function createCheckoutSession(
  customerId: string,
  plan: 'basic' | 'pro',
  tenantId: string
) {
  const priceId = plan === 'basic' ? env.STRIPE_BASIC_PRICE_ID : env.STRIPE_PRO_PRICE_ID
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.FRONTEND_URL}/billing/success`,
    cancel_url: `${env.FRONTEND_URL}/billing`,
    metadata: { tenantId },
  })
}

export async function createPortalSession(customerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.FRONTEND_URL}/billing`,
  })
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = toCustomerId(sub.customer)
  const priceId = sub.items.data[0]?.price.id ?? ''
  const plan = getPlanFromPriceId(priceId)
  const status = mapStripeStatus(sub.status)
  const rawEnd = (sub as unknown as { current_period_end: number }).current_period_end
  const periodEnd = rawEnd ? new Date(rawEnd * 1000) : null

  await db
    .update(subscriptions)
    .set({ stripe_sub_id: sub.id, plan, status, ...(periodEnd && { current_period_end: periodEnd }) })
    .where(eq(subscriptions.stripe_customer_id, customerId))

  const [subRow] = await db
    .select({ tenant_id: subscriptions.tenant_id })
    .from(subscriptions)
    .where(eq(subscriptions.stripe_customer_id, customerId))
    .limit(1)

  if (subRow) {
    await db.update(tenants).set({ plan }).where(eq(tenants.id, subRow.tenant_id))
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted': {
      const customerId = toCustomerId((event.data.object as Stripe.Subscription).customer)
      await db
        .update(subscriptions)
        .set({ status: 'cancelled' })
        .where(eq(subscriptions.stripe_customer_id, customerId))
      break
    }

    case 'invoice.payment_failed': {
      const customerId = toCustomerId((event.data.object as Stripe.Invoice).customer!)
      await db
        .update(subscriptions)
        .set({ status: 'past_due' })
        .where(eq(subscriptions.stripe_customer_id, customerId))
      break
    }
  }
}
