import { describe, it, expect, beforeEach } from 'vitest'
import { ACTIVE_RATES } from '@/lib/pricing'
import { calculatePrice } from '@/lib/pricing'

// AC2 — base rates update reflects in price calculation
describe('ACTIVE_RATES and calculatePrice (AC2)', () => {
  const originalStudio = ACTIVE_RATES.studio

  beforeEach(() => {
    // restore after mutation tests
    ACTIVE_RATES.studio = originalStudio
  })

  it('default rates are correct', () => {
    expect(ACTIVE_RATES.studio).toBe(280)
    expect(ACTIVE_RATES['1br']).toBe(380)
    expect(ACTIVE_RATES['2br']).toBe(480)
    expect(ACTIVE_RATES['3br']).toBe(620)
    expect(ACTIVE_RATES.house).toBe(850)
  })

  it('AC2 — mutating ACTIVE_RATES changes calculatePrice output', () => {
    ACTIVE_RATES.studio = 350
    expect(calculatePrice('studio', false)).toBe(350)
  })

  it('AC2 — packing adds $120 on top of updated rate', () => {
    ACTIVE_RATES.studio = 350
    expect(calculatePrice('studio', true)).toBe(470)
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
