import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { subscriptions, tenants } from '../db/schema.js'
import { sendPaymentConfirmationEmail } from '../lib/email.js'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { stripe } from '../lib/stripe.js'
import type { Plan, SubscriptionStatus } from '../types/index.js'
import {
  clearInvoiceCheckoutSession,
  markInvoiceDisputed,
  markInvoicePaidFromSession,
  markInvoiceRefunded,
} from './invoices.service.js'
import { claimStripeEvent } from './stripe-events.service.js'

function getPlanFromPriceId(priceId: string): Plan {
  if (priceId === env.STRIPE_BASIC_PRICE_ID) return 'basic'
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro'
  // Either a live-mode price id hit a test-mode env var (or vice versa) or a plan
  // was added in Stripe without updating the env vars — either way, silently
  // defaulting here previously downgraded a Pro customer to Basic with no trace.
  logger.error({ priceId }, 'Stripe price id matches neither configured plan — defaulting to basic')
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

// Several event object shapes (Subscription, Invoice, Checkout.Session, Charge) all
// carry an optional `customer` field of the same union type — used both for the
// ordering ledger (claimStripeEvent) and for S4's null-check on invoice.payment_failed.
function extractCustomerId(event: Stripe.Event): string | null {
  const obj = event.data.object as { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }
  return obj.customer ? toCustomerId(obj.customer) : null
}

function toId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
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

// checkout.session.completed / async_payment_succeeded both mean the payment
// actually landed — the only difference is whether it was confirmed synchronously
// or (for delayed methods like ACH) some time later.
async function handleCheckoutPaid(session: Stripe.Checkout.Session): Promise<void> {
  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) return // subscription checkout — handled via subscription.* events

  const paid = await markInvoicePaidFromSession({
    invoiceId,
    paymentIntentId: toId(session.payment_intent),
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status === 'paid') {
    await handleCheckoutPaid(session)
    return
  }
  // 'unpaid' here means a delayed payment method (e.g. ACH) is still pending —
  // wait for async_payment_succeeded/failed instead of treating this as terminal.
  logger.info({ sessionId: session.id }, 'Checkout completed with a pending async payment')
}

// async_payment_failed / expired: the customer never paid. The invoice stays
// 'sent' so the same share link still works — only the stale session id is
// cleared so a fresh payment-link request isn't confused with the dead one.
async function handleCheckoutNotPaid(session: Stripe.Checkout.Session, reason: string): Promise<void> {
  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) return
  logger.warn({ invoiceId, sessionId: session.id, reason }, 'Checkout session did not result in payment')
  await clearInvoiceCheckoutSession(invoiceId)
}

// Returns true if it recognized and handled the event, so the caller knows whether
// to try the other dispatch table.
async function dispatchCheckoutOrChargeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      return true

    case 'checkout.session.async_payment_succeeded':
      await handleCheckoutPaid(event.data.object as Stripe.Checkout.Session)
      return true

    case 'checkout.session.async_payment_failed':
      await handleCheckoutNotPaid(event.data.object as Stripe.Checkout.Session, 'async_payment_failed')
      return true

    case 'checkout.session.expired':
      await handleCheckoutNotPaid(event.data.object as Stripe.Checkout.Session, 'expired')
      return true

    case 'charge.refunded': {
      const paymentIntentId = toId((event.data.object as Stripe.Charge).payment_intent)
      if (paymentIntentId) await markInvoiceRefunded(paymentIntentId)
      return true
    }

    case 'charge.dispute.created': {
      const paymentIntentId = toId((event.data.object as Stripe.Dispute).payment_intent)
      if (paymentIntentId) await markInvoiceDisputed(paymentIntentId)
      return true
    }

    default:
      return false
  }
}

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  // customer can be null on some invoice objects (e.g. one-off, customer-less
  // invoices) — asserting it non-null here used to throw, and Stripe retries a
  // 500 for 3 days.
  const customerId = extractCustomerId(event)
  if (!customerId) {
    logger.warn({ eventId: event.id }, 'invoice.payment_failed with no customer — skipping')
    return
  }
  await db.update(subscriptions).set({ status: 'past_due' }).where(eq(subscriptions.stripe_customer_id, customerId))
}

async function dispatchSubscriptionEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription)
      return true

    case 'customer.subscription.deleted': {
      const customerId = toCustomerId((event.data.object as Stripe.Subscription).customer)
      await db.update(subscriptions).set({ status: 'cancelled' }).where(eq(subscriptions.stripe_customer_id, customerId))
      return true
    }

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event)
      return true

    default:
      return false
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const claim = await claimStripeEvent({
    id: event.id,
    type: event.type,
    created: new Date(event.created * 1000),
    customerId: extractCustomerId(event),
  })
  if (claim !== 'process') return

  if (await dispatchCheckoutOrChargeEvent(event)) return
  await dispatchSubscriptionEvent(event)
}
