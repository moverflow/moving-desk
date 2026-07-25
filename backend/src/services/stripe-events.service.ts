import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { stripeEvents } from '../db/schema.js'

// Event types that write subscriptions.status — an out-of-order delivery of any of
// these can regress a newer status (e.g. 'active') back to an older one (e.g.
// 'past_due'). Ordering is only enforced within this set; checkout/invoice-paid
// events are unaffected since they don't touch subscription status.
const SUBSCRIPTION_STATUS_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const

export type ClaimResult = 'process' | 'duplicate' | 'stale'

async function isOlderThanLastApplied(customerId: string, created: Date): Promise<boolean> {
  const [latest] = await db
    .select({ created: sql<Date | null>`max(${stripeEvents.created})` })
    .from(stripeEvents)
    .where(
      and(
        eq(stripeEvents.customer_id, customerId),
        inArray(stripeEvents.type, [...SUBSCRIPTION_STATUS_EVENT_TYPES]),
      ),
    )
  return latest?.created ? created < new Date(latest.created) : false
}

async function recordEvent(
  id: string,
  type: string,
  created: Date,
  customerId: string | null,
): Promise<void> {
  await db.insert(stripeEvents).values({ id, customer_id: customerId, type, created })
}

// Claims a Stripe event for processing: 'duplicate' if this exact event id was
// already recorded (webhook redelivery), 'stale' if it's an older
// subscription-status event than the last one already applied for this customer,
// 'process' otherwise. Always records the event (including stale ones) so a later
// redelivery of the same event is caught by the id check, not re-evaluated.
export async function claimStripeEvent(params: {
  id: string
  type: string
  created: Date
  customerId: string | null
}): Promise<ClaimResult> {
  const [existing] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, params.id))
    .limit(1)
  if (existing) return 'duplicate'

  const isOrderSensitive =
    params.customerId !== null &&
    (SUBSCRIPTION_STATUS_EVENT_TYPES as readonly string[]).includes(params.type)
  const isStale =
    isOrderSensitive && (await isOlderThanLastApplied(params.customerId as string, params.created))

  await recordEvent(params.id, params.type, params.created, params.customerId)
  return isStale ? 'stale' : 'process'
}
