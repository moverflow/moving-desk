import { describe, it, expect } from 'vitest'
import type { AppNotification } from '@/types'
import { notificationLink } from './useNotifications'

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n-1',
    type: 'invoice_paid',
    title: 'Invoice INV-1089 paid',
    body: null,
    relatedType: 'invoice',
    relatedId: 'invoice-1',
    readAt: null,
    createdAt: '2026-07-25T10:00:00.000Z',
    ...overrides,
  }
}

describe('notificationLink', () => {
  it('AC3 — links an invoice notification to the invoice deep link', () => {
    expect(notificationLink(notification())).toBe('/invoices?invoice=invoice-1')
  })

  it('AC3 — links an order notification to the order deep link', () => {
    expect(
      notificationLink(notification({ relatedType: 'order', relatedId: 'order-7' })),
    ).toBe('/orders?order=order-7')
  })

  it('AC3 — links a lead notification to the leads pipeline', () => {
    expect(notificationLink(notification({ relatedType: 'lead', relatedId: 'lead-3' }))).toBe(
      '/orders?tab=leads',
    )
  })

  it('falls back to the orders board when there is no related record', () => {
    expect(notificationLink(notification({ relatedType: null, relatedId: null }))).toBe('/orders')
  })
})
