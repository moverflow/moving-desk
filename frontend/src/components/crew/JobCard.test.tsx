import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CrewJob } from '@/types'
import JobCard from './JobCard'

vi.mock('@/hooks/useCrewJobs', () => ({
  useCrewJobFiles: vi.fn(() => ({ data: [] })),
}))

function makeJob(overrides: Partial<CrewJob> = {}): CrewJob {
  return {
    id: 'order-1',
    status: 'confirmed',
    moveDate: '2026-07-18',
    fromAddress: '123 Oak St, Irvine, CA 92602',
    toAddress: '456 Pine Ave, Anaheim, CA 92801',
    fromFloor: 3,
    toFloor: 1,
    fromElevator: false,
    toElevator: true,
    homeSize: '2br',
    packing: true,
    notes: 'Piano on 2nd floor',
    totalPrice: 48000,
    clientName: 'Rick Adams',
    clientPhone: '9496329557',
    ...overrides,
  }
}

describe('JobCard', () => {
  it('AC12 — shows addresses, floors, elevator, notes and client', () => {
    render(<JobCard job={makeJob()} onUpdateStatus={vi.fn()} isUpdating={false} />)
    expect(screen.getByText('123 Oak St, Irvine, CA 92602')).toBeInTheDocument()
    expect(screen.getByText('456 Pine Ave, Anaheim, CA 92801')).toBeInTheDocument()
    expect(screen.getByText('Floor 3 — No elevator')).toBeInTheDocument()
    expect(screen.getByText('Floor 1 — Elevator available')).toBeInTheDocument()
    expect(screen.getByText(/Piano on 2nd floor/)).toBeInTheDocument()
    expect(screen.getByText(/Rick Adams/)).toBeInTheDocument()
  })

  it('AC13 — Call button links to the phone dialer', () => {
    render(<JobCard job={makeJob()} onUpdateStatus={vi.fn()} isUpdating={false} />)
    const call = screen.getByRole('link', { name: /call/i })
    expect(call).toHaveAttribute('href', 'tel:9496329557')
  })

  it('AC14 — confirmed job shows only Start move', () => {
    render(<JobCard job={makeJob({ status: 'confirmed' })} onUpdateStatus={vi.fn()} isUpdating={false} />)
    expect(screen.getByRole('button', { name: /start move/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complete move/i })).not.toBeInTheDocument()
  })

  it('AC15 — in_progress job shows only Complete move', () => {
    render(<JobCard job={makeJob({ status: 'in_progress' })} onUpdateStatus={vi.fn()} isUpdating={false} />)
    expect(screen.getByRole('button', { name: /complete move/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start move/i })).not.toBeInTheDocument()
  })

  it('AC16 — completed job shows a badge and no action buttons', () => {
    render(<JobCard job={makeJob({ status: 'completed' })} onUpdateStatus={vi.fn()} isUpdating={false} />)
    expect(screen.getByText('✅ Completed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument()
  })

  it('AC14 — tapping Start move requests the in_progress transition', async () => {
    const user = userEvent.setup()
    const onUpdateStatus = vi.fn()
    render(<JobCard job={makeJob({ status: 'confirmed' })} onUpdateStatus={onUpdateStatus} isUpdating={false} />)
    await user.click(screen.getByRole('button', { name: /start move/i }))
    expect(onUpdateStatus).toHaveBeenCalledWith('in_progress')
  })
})
