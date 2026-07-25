import { describe, it, expect } from 'vitest'
import { DEFAULT_PRICING, calculatePrice, type Pricing } from './pricing'

describe('calculatePrice', () => {
  it('returns correct base rate for each home size', () => {
    expect(calculatePrice('studio', false)).toBe(280)
    expect(calculatePrice('1br', false)).toBe(380)
    expect(calculatePrice('2br', false)).toBe(480)
    expect(calculatePrice('3br', false)).toBe(620)
    expect(calculatePrice('house', false)).toBe(850)
  })

  it('AC3 — adds $120 when packing is true', () => {
    expect(calculatePrice('2br', true)).toBe(600)
    expect(calculatePrice('house', true)).toBe(970)
  })

  it('packing=false does not add to price', () => {
    expect(calculatePrice('studio', false)).toBe(280)
  })

  it('the packing fee is dollars not cents — a 2BR move is never five figures', () => {
    expect(calculatePrice('2br', true)).toBeLessThan(1000)
  })

  it('uses tenant pricing when supplied', () => {
    const pricing: Pricing = {
      baseRates: { studio: 300, '1br': 400, '2br': 500, '3br': 650, house: 900 },
      packingFee: 175,
    }
    expect(calculatePrice('2br', false, pricing)).toBe(500)
    expect(calculatePrice('2br', true, pricing)).toBe(675)
    expect(calculatePrice('house', true, pricing)).toBe(1075)
  })

  it('honours a zero packing fee rather than falling back to the default', () => {
    const pricing: Pricing = { baseRates: DEFAULT_PRICING.baseRates, packingFee: 0 }
    expect(calculatePrice('2br', true, pricing)).toBe(480)
  })

  it('falls back to the default rate for a home size the tenant has not priced', () => {
    const pricing = { baseRates: { studio: 300 }, packingFee: 100 } as unknown as Pricing
    expect(calculatePrice('house', false, pricing)).toBe(850)
    expect(calculatePrice('studio', false, pricing)).toBe(300)
  })
})
