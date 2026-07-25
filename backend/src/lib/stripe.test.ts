import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const FULL_STRIPE = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
}

// stripe.ts builds its Stripe client at module scope from env, so each case
// re-imports the module against a freshly mocked env — same pattern as r2.test.ts.
async function loadStripe(overrides: Record<string, string>) {
  vi.doMock('./env.js', () => ({
    env: {
      NODE_ENV: 'development',
      ...FULL_STRIPE,
      ...overrides,
    },
  }))
  return import('./stripe.js')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('./env.js')
})

describe('missingStripeVars', () => {
  it('returns an empty list when both Stripe vars are set', async () => {
    const { missingStripeVars } = await loadStripe({})
    expect(missingStripeVars()).toEqual([])
  })

  it('names the single var that is empty', async () => {
    const { missingStripeVars } = await loadStripe({ STRIPE_WEBHOOK_SECRET: '' })
    expect(missingStripeVars()).toEqual(['STRIPE_WEBHOOK_SECRET'])
  })

  it('names both vars when both are missing', async () => {
    const { missingStripeVars } = await loadStripe({ STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' })
    expect(missingStripeVars()).toEqual(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])
  })
})

describe('assertStripeConfigured', () => {
  it('S5 — throws in production when a Stripe var is missing', async () => {
    const { assertStripeConfigured } = await loadStripe({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: '',
    })
    expect(() => assertStripeConfigured()).toThrow(/Stripe is not configured/)
  })

  it('lists every missing var in the error message', async () => {
    const { assertStripeConfigured } = await loadStripe({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    })
    expect(() => assertStripeConfigured()).toThrow(
      /Missing env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET/,
    )
  })

  it('does not throw in production when Stripe is fully configured', async () => {
    const { assertStripeConfigured } = await loadStripe({ NODE_ENV: 'production' })
    expect(() => assertStripeConfigured()).not.toThrow()
  })

  it('does not throw in development with no Stripe vars set', async () => {
    const { assertStripeConfigured } = await loadStripe({
      NODE_ENV: 'development',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    })
    expect(() => assertStripeConfigured()).not.toThrow()
  })
})
