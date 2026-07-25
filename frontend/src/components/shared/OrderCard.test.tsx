import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Order, OrderStatus } from '@/types'
import OrderCard, { STATUS_BORDER } from './OrderCard'

// The four columns the Kanban actually renders (OrdersPage COLUMNS).
const KANBAN_STATUSES: OrderStatus[] = ['new', 'confirmed', 'in_progress', 'completed']

function order(status: OrderStatus): Order {
  return {
    id: 'order-1',
    status,
    clientName: 'Rick Adams',
    fromAddress: '123 Oak St',
    toAddress: '456 Pine Ave',
    moveDate: '2026-08-14',
    homeSize: '2br',
  } as Order
}

function borderClassesOf(status: OrderStatus): string[] {
  const { container } = render(<OrderCard order={order(status)} onClick={vi.fn()} />)
  const card = container.querySelector('button')
  return Array.from(card?.classList ?? [])
}

describe('STATUS_BORDER palette', () => {
  it('gives every Kanban column a distinct border colour', () => {
    const colours = KANBAN_STATUSES.map((s) => STATUS_BORDER[s])
    expect(new Set(colours).size).toBe(KANBAN_STATUSES.length)
  })

  it('covers every order status, so no card falls back to an undefined class', () => {
    const all: OrderStatus[] = [
      'new',
      'confirmed',
      'in_progress',
      'completed',
      'closed',
      'cancelled',
    ]
    for (const status of all) {
      expect(STATUS_BORDER[status]).toMatch(/^border-l-/)
    }
  })

  it('reserves green for completed work and red for cancelled', () => {
    expect(STATUS_BORDER.completed).toContain('green')
    expect(STATUS_BORDER.cancelled).toContain('red')
    expect(STATUS_BORDER.in_progress).not.toContain('green')
  })

  it('uses only stock Tailwind scale colours, not invented tokens', () => {
    for (const cls of Object.values(STATUS_BORDER)) {
      expect(cls).toMatch(/^border-l-(blue|amber|violet|green|gray|red)-\d{3}$/)
    }
  })
})

describe('OrderCard', () => {
  it('applies the status border colour to the card', () => {
    for (const status of KANBAN_STATUSES) {
      expect(borderClassesOf(status)).toContain(STATUS_BORDER[status])
    }
  })

  it('keeps the thick left edge that carries the colour', () => {
    const classes = borderClassesOf('new')
    expect(classes).toContain('border-l-4')
    expect(classes).toContain('border')
  })

  it('never renders an undefined class string', () => {
    for (const status of KANBAN_STATUSES) {
      expect(borderClassesOf(status)).not.toContain('undefined')
    }
  })

  it('still renders the card content unchanged', () => {
    render(<OrderCard order={order('new')} onClick={vi.fn()} />)
    expect(screen.getByText('Rick Adams')).toBeInTheDocument()
    expect(screen.getByText('123 Oak St → 456 Pine Ave')).toBeInTheDocument()
  })
})
