import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Lead } from '@/types'
import LeadCard from './LeadCard'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    name: 'Rick Adams',
    phone: '9496329557',
    email: null,
    fromAddress: 'Irvine, CA',
    toAddress: 'Anaheim, CA',
    moveDate: '2026-07-20',
    homeSize: '2br',
    notes: null,
    status: 'new',
    source: 'booking_page',
    convertedOrderId: null,
    createdAt: '2026-07-18',
    ...overrides,
  }
}

function renderCard(lead: Lead) {
  return render(
    <MemoryRouter>
      <LeadCard lead={lead} onAdvance={vi.fn()} onConvert={vi.fn()} onLost={vi.fn()} isBusy={false} />
    </MemoryRouter>,
  )
}

describe('LeadCard', () => {
  it('AC17 — shows the source badge (booking_page → Online)', () => {
    renderCard(makeLead({ source: 'booking_page' }))
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('AC17 — zapier source shows a Zapier badge', () => {
    renderCard(makeLead({ source: 'zapier' }))
    expect(screen.getByText('Zapier')).toBeInTheDocument()
  })

  it('new lead shows "Mark as Contacted"', () => {
    renderCard(makeLead({ status: 'new' }))
    expect(screen.getByRole('button', { name: /mark as contacted/i })).toBeInTheDocument()
  })

  it('contacted lead shows "Send Quote"', () => {
    renderCard(makeLead({ status: 'contacted' }))
    expect(screen.getByRole('button', { name: /send quote/i })).toBeInTheDocument()
  })

  it('quoted lead offers "Book it"', () => {
    renderCard(makeLead({ status: 'quoted' }))
    expect(screen.getByRole('button', { name: /book it/i })).toBeInTheDocument()
  })

  it('booked lead shows a link to the order and no action buttons', () => {
    renderCard(makeLead({ status: 'booked', convertedOrderId: 'order-9' }))
    expect(screen.getByRole('link', { name: /view order/i })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
