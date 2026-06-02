import { describe, it, expect } from 'vitest'
import { findClientByPhone } from './useOrders'

describe('findClientByPhone', () => {
  it('AC2 — returns client data for known phone numbers', () => {
    const result = findClientByPhone('(949) 632-9557')
    expect(result).not.toBeNull()
    expect(result?.clientName).toBe('Rick Adams')
    expect(result?.fromAddress).toBe('Lake Forest, CA 92630')
  })

  it('AC2 — returns null for unknown phone', () => {
    expect(findClientByPhone('(000) 000-0000')).toBeNull()
  })

  it('AC2 — returns correct data for all mock clients', () => {
    expect(findClientByPhone('(310) 555-0177')?.clientName).toBe('Tom Wilson')
    expect(findClientByPhone('(657) 555-0201')?.clientName).toBe('Sarah Park')
    expect(findClientByPhone('(714) 555-0142')?.clientName).toBe('James Lee')
  })
})
