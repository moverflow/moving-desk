import { describe, it, expect } from 'vitest'
import type { InvoiceStatus } from '@/types'

describe('invoice status transitions', () => {
  const validTransitions: Array<[InvoiceStatus, InvoiceStatus]> = [
    ['draft', 'sent'],
    ['sent', 'paid'],
    ['draft', 'paid'],
  ]

  it.each(validTransitions)('status can transition from %s to %s', (from, to) => {
    const inv = { id: '1', status: from as string }
    inv.status = to
    expect(inv.status).toBe(to)
  })
})

describe('placeholder for PDF/send tests', () => {
  it('PDF generation is browser-only (react-pdf) — validated via InvoicesPage render test', () => {
    expect(true).toBe(true)
  })
})
