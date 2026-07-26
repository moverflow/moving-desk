import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderDetailSheet from './OrderDetailSheet'
import type { Order, Crew } from '@/types'

vi.mock('@/hooks/useOrders', () => ({
  useUpdateOrderStatus: vi.fn(),
  useSendContract: vi.fn(),
}))

vi.mock('@/hooks/useCrews', () => ({
  useCrews: vi.fn(),
}))

vi.mock('@/hooks/useOrderFiles', () => ({
  useOrderFiles: vi.fn(() => ({ data: [] })),
  useUploadOrderFile: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteOrderFile: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

import { useUpdateOrderStatus, useSendContract } from '@/hooks/useOrders'
import { useCrews } from '@/hooks/useCrews'

const updateMock = vi.fn()
const CREWS: Crew[] = [
  { id: 'crew-1', name: 'Alpha', truckLabel: 'Truck 1', active: true },
  { id: 'crew-2', name: 'Bravo', truckLabel: 'Truck 2', active: true },
]

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    clientName: 'Jane Doe',
    phone: '9495551234',
    fromAddress: '100 Main St',
    toAddress: '200 Beach Blvd',
    moveDate: '2026-08-15',
    homeSize: '2br',
    status: 'confirmed',
    fromFloor: 1,
    toFloor: 1,
    fromElevator: false,
    toElevator: false,
    packing: false,
    totalPrice: 480,
    createdAt: '2026-07-01T00:00:00Z',
    isOnline: true,
    contractStatus: 'none',
    ...overrides,
  }
}

beforeEach(() => {
  updateMock.mockReset()
  vi.mocked(useUpdateOrderStatus).mockReturnValue({ mutate: updateMock, isPending: false } as unknown as ReturnType<typeof useUpdateOrderStatus>)
  vi.mocked(useSendContract).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSendContract>)
  vi.mocked(useCrews).mockReturnValue({ data: CREWS } as unknown as ReturnType<typeof useCrews>)
})

// The whole point of this task: a booking-page order (crew_id null) had no
// UI path to get a crew assigned — this is the write path that fixes it.
describe('OrderDetailSheet — crew assignment', () => {
  it('pre-selects "Unassigned" for an order with no crew, and assigns one on Save', async () => {
    const user = userEvent.setup()
    render(<OrderDetailSheet order={baseOrder({ crewId: undefined })} onClose={vi.fn()} />)

    expect(screen.getByText('Unassigned')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Crew'))
    await user.click(await screen.findByRole('option', { name: /alpha — truck 1/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', crewId: 'crew-1' }),
      expect.anything(),
    )
  })

  it('pre-selects the currently assigned crew', () => {
    render(<OrderDetailSheet order={baseOrder({ crewId: 'crew-2', crewName: 'Bravo — Truck 2' })} onClose={vi.fn()} />)

    expect(screen.getByText('Bravo — Truck 2')).toBeInTheDocument()
  })

  it('reassigns from one crew to another', async () => {
    const user = userEvent.setup()
    render(<OrderDetailSheet order={baseOrder({ crewId: 'crew-1', crewName: 'Alpha — Truck 1' })} onClose={vi.fn()} />)

    await user.click(screen.getByLabelText('Crew'))
    await user.click(await screen.findByRole('option', { name: /bravo — truck 2/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', crewId: 'crew-2' }),
      expect.anything(),
    )
  })

  it('unassigns a crew by selecting "Unassigned" again', async () => {
    const user = userEvent.setup()
    render(<OrderDetailSheet order={baseOrder({ crewId: 'crew-1', crewName: 'Alpha — Truck 1' })} onClose={vi.fn()} />)

    await user.click(screen.getByLabelText('Crew'))
    await user.click(await screen.findByRole('option', { name: /^unassigned$/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', crewId: null }),
      expect.anything(),
    )
  })

  // Regression: the backend's PATCH schema rejects resending an unchanged
  // 'new' status (it's only ever transitioned out of, never back into) — a
  // booking-page-converted order is always 'new', so this would otherwise
  // 400 and silently block the crewId update riding alongside it.
  it('does not resend an unchanged status alongside a crew-only change', async () => {
    const user = userEvent.setup()
    render(<OrderDetailSheet order={baseOrder({ status: 'new', crewId: undefined })} onClose={vi.fn()} />)

    await user.click(screen.getByLabelText('Crew'))
    await user.click(await screen.findByRole('option', { name: /alpha — truck 1/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateMock).toHaveBeenCalledWith(
      { id: 'order-1', crewId: 'crew-1' },
      expect.anything(),
    )
  })

  it('sends the new status alongside the crew change when status was actually edited', async () => {
    const user = userEvent.setup()
    render(<OrderDetailSheet order={baseOrder({ status: 'confirmed', crewId: undefined })} onClose={vi.fn()} />)

    await user.click(screen.getByLabelText('Status'))
    await user.click(await screen.findByRole('option', { name: /^in progress$/i }))
    await user.click(screen.getByLabelText('Crew'))
    await user.click(await screen.findByRole('option', { name: /alpha — truck 1/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress', crewId: 'crew-1' }),
      expect.anything(),
    )
  })
})
