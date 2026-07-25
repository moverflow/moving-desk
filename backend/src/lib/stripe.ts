import Stripe from 'stripe'
import { env } from './env.js'

const STRIPE_ENV_VARS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const

export function missingStripeVars(): string[] {
  return STRIPE_ENV_VARS.filter((name) => !env[name])
}

// Both defaulting to '' lets a misconfigured deploy boot fine and every payment
// attempt (checkout, webhook signature verify) throw at runtime instead. Same
// posture as assertStorageConfigured() in r2.ts — never acceptable in production.
export function assertStripeConfigured(): void {
  if (env.NODE_ENV !== 'production') return

  const missing = missingStripeVars()
  if (missing.length === 0) return

  throw new Error(
    `Stripe is not configured. Missing env vars: ${missing.join(', ')}. ` +
      'Refusing to start in production: checkout sessions could not be created and ' +
      'webhook signatures could not be verified.',
  )
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder')
