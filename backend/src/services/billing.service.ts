import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { subscriptions, tenants } from '../db/schema.js'
import { sendPaymentConfirmationEmail } from '../lib/email.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { stripe } from '../lib/stripe.js'
import type { Plan, SubscriptionStatus } from '../types/index.js'
import { markInvoicePaidFromSession } from './invoices.service.js'

function getPlanFromPriceId(priceId: string): Plan {
  if (priceId === env.STRIPE_BASIC_PRICE_ID) return 'basic'
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro'
  return 'basic'
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
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

export async function getSubscription(tenantId: string) {
  const rows = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      trialEndsAt: tenants.trial_ends_at,
    })
    .from(subscriptions)
    .innerJoin(tenants, eq(tenants.id, subscriptions.tenant_id))
    .where(eq(subscriptions.tenant_id, tenantId))
    .limit(1)
  return rows[0] ?? null
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return

  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) return // subscription checkout — handled via subscription.* events

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  const paid = await markInvoicePaidFromSession({
    invoiceId,
    paymentIntentId,
    amountTotal: session.amount_total,
  })

  if (!paid) return // already paid (idempotent replay) or not found

  if (paid.clientEmail) {
    sendPaymentConfirmationEmail({
      to: paid.clientEmail,
      clientName: paid.clientName ?? 'Client',
      companyName: paid.companyName,
      amount: paid.amount,
      moveDate: paid.moveDate,
      invoiceNumber: paid.number,
    })
  }

  logger.info({ invoiceId, amount: paid.amount }, 'Invoice paid via Stripe checkout')
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

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
