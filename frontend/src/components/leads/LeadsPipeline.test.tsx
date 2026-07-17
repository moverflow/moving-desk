import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Lead } from '@/types'
import LeadsPipeline from './LeadsPipeline'
import { useLeads } from '@/hooks/useLeads'

vi.mock('@/hooks/useLeads', () => ({
  useLeads: vi.fn(),
  useUpdateLead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkLeadLost: () => ({ mutate: vi.fn(), isPending: false }),
  useConvertLead: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateLead: () => ({ mutate: vi.fn(), isPending: false }),
}))

function lead(id: string, name: string, status: Lead['status']): Lead {
  return {
    id, name, phone: null, email: null, fromAddress: null, toAddress: null,
    moveDate: null, homeSize: null, notes: null, status, source: 'manual',
    convertedOrderId: null, createdAt: '2026-07-18',
  }
}

const LEADS: Lead[] = [
  lead('1', 'Alice', 'new'),
  lead('2', 'Bob', 'new'),
  lead('3', 'Carol', 'contacted'),
  lead('4', 'Dave', 'booked'),
  lead('5', 'Eve', 'lost'),
]

function renderPipeline() {
  return render(
    <MemoryRouter>
      <LeadsPipeline onConverted={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(useLeads).mockReturnValue({ data: LEADS, isLoading: false } as unknown as ReturnType<typeof useLeads>)
})

describe('LeadsPipeline', () => {
  it('AC18 — renders pipeline columns with correct counts', () => {
    renderPipeline()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Contacted')).toBeInTheDocument()
    expect(screen.getByText('Quoted')).toBeInTheDocument()
    expect(screen.getByText('Booked')).toBeInTheDocument()
    // Two 'new' leads → the unique count of 2 belongs to the New column.
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('AC19 — lost leads are hidden by default and revealed by the toggle', async () => {
    const user = userEvent.setup()
    renderPipeline()

    expect(screen.queryByText('Eve')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /show lost leads/i }))

    expect(screen.getByText('Eve')).toBeInTheDocument()
  })
})
