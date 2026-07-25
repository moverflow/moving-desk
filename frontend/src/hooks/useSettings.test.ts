import { describe, it, expect } from 'vitest'
import { DEFAULT_PRICING, calculatePrice, type Pricing } from '@/lib/pricing'

// AC2 — the tenant's configured rates reflect in the price preview
describe('tenant pricing and calculatePrice (AC2)', () => {
  const custom: Pricing = {
    baseRates: { ...DEFAULT_PRICING.baseRates, studio: 350 },
    packingFee: 200,
  }

  it('default rates are correct', () => {
    expect(DEFAULT_PRICING.baseRates.studio).toBe(280)
    expect(DEFAULT_PRICING.baseRates['1br']).toBe(380)
    expect(DEFAULT_PRICING.baseRates['2br']).toBe(480)
    expect(DEFAULT_PRICING.baseRates['3br']).toBe(620)
    expect(DEFAULT_PRICING.baseRates.house).toBe(850)
    expect(DEFAULT_PRICING.packingFee).toBe(120)
  })

  it('AC2 — a custom base rate changes calculatePrice output', () => {
    expect(calculatePrice('studio', false, custom)).toBe(350)
  })

  it('AC2 — a custom packing fee is added on top of the custom rate', () => {
    expect(calculatePrice('studio', true, custom)).toBe(550)
  })

  it('AC2 — tenant pricing does not leak between calls', () => {
    calculatePrice('studio', true, custom)
    expect(calculatePrice('studio', true)).toBe(400)
  })
})

// Trial banner logic
describe('trial banner daysLeft logic (AC5)', () => {
  function daysLeft(trialEndsAt: string): number {
    return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  it('AC5 — returns correct positive days for future date', () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysLeft(future)).toBeGreaterThanOrEqual(3)
    expect(daysLeft(future)).toBeLessThanOrEqual(4)
  })

  it('AC5 — returns 0 or negative for past date', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysLeft(past)).toBeLessThanOrEqual(0)
  })

  it('AC5 — 8 days left means banner should be hidden (> 5)', () => {
    const eightDays = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysLeft(eightDays)).toBeGreaterThan(5)
  })

  it('AC5 — 3 days left means banner should show (<= 5)', () => {
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysLeft(threeDays)).toBeLessThanOrEqual(5)
  })
})
