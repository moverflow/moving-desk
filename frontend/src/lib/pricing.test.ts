import { describe, it, expect } from 'vitest'
import { calculatePrice } from './pricing'

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
})
