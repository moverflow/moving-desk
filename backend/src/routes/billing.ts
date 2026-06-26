import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../lib/env.js'
import { stripe } from '../lib/stripe.js'
import { authMiddleware, requireOwner } from '../middleware/auth.js'
import {
  createCheckoutSession,
  createPortalSession,
  getStripeCustomerId,
  getSubscription,
  handleWebhookEvent,
} from '../services/billing.service.js'
import type { AppVariables } from '../types/index.js'

const checkoutSchema = z.object({ plan: z.enum(['basic', 'pro']) })

const billingRouter = new Hono<{ Variables: AppVariables }>()

billingRouter.get('/subscription', authMiddleware, async (c) => {
  const sub = await getSubscription(c.get('tenantId'))
  if (!sub) return c.json({ error: 'Subscription not found' }, 404)
  return c.json({
    plan: sub.plan,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
  })
})

billingRouter.post('/checkout', authMiddleware, requireOwner, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = checkoutSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const tenantId = c.get('tenantId')
  const customerId = await getStripeCustomerId(tenantId)
  if (!customerId) return c.json({ error: 'Billing not configured' }, 422)

  const session = await createCheckoutSession(customerId, result.data.plan, tenantId)
  return c.json({ url: session.url })
})

billingRouter.post('/portal', authMiddleware, requireOwner, async (c) => {
  const customerId = await getStripeCustomerId(c.get('tenantId'))
  if (!customerId) return c.json({ error: 'Billing not configured' }, 422)

  const session = await createPortalSession(customerId)
  return c.json({ url: session.url })
})

billingRouter.post('/webhook', async (c) => {
  const body = await c.req.text()
  const sig = c.req.header('stripe-signature') ?? ''

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  await handleWebhookEvent(event)
  return c.json({ received: true })
})

export default billingRouter
