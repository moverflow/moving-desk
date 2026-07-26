import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContractSection from './ContractSection'
import type { Order } from '@/types'

vi.mock('@/hooks/useOrders', () => ({
  useSendContract: vi.fn(),
}))

vi.mock('@/hooks/useOrderFiles', () => ({
  useOrderFiles: vi.fn(() => ({ data: [] })),
}))

import { useSendContract } from '@/hooks/useOrders'

const sendMock = vi.fn()

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    clientName: 'Rick Adams',
    phone: '9496329557',
    fromAddress: 'Irvine, CA',
    toAddress: 'Anaheim, CA',
    moveDate: '2026-08-01',
    homeSize: '3br',
    status: 'confirmed',
    fromFloor: 1,
    toFloor: 1,
    fromElevator: false,
    toElevator: false,
    packing: false,
    totalPrice: 620,
    createdAt: '2026-07-01T00:00:00Z',
    isOnline: false,
    contractStatus: 'none',
    ...overrides,
  }
}

beforeEach(() => {
  sendMock.mockReset()
  vi.mocked(useSendContract).mockReturnValue({ mutate: sendMock, isPending: false } as unknown as ReturnType<typeof useSendContract>)
})

// The whole point of this task: Resend goes through the same Resend sandbox
// restriction as every other email in this app, so a copyable link is the
// only reliable fallback — mirrors BookingTab/TeamTab's "Copy link" pattern.
describe('ContractSection — contract copy-link fallback', () => {
  it('shows the contract link with a Copy link button while waiting for signature', () => {
    render(<ContractSection order={baseOrder({ contractStatus: 'sent', contractToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })} />)

    expect(screen.getByText(/waiting for signature/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
    expect(screen.getByText(/contract\/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })

  it('copies the contract link to the clipboard and shows confirmation', async () => {
    const user = userEvent.setup()
    render(<ContractSection order={baseOrder({ contractStatus: 'sent', contractToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })} />)

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    expect(await navigator.clipboard.readText()).toContain('/contract/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeInTheDocument()
  })

  it('does not show a copy-link block when the order has no contract token yet', () => {
    render(<ContractSection order={baseOrder({ contractStatus: 'sent', contractToken: undefined })} />)

    expect(screen.getByText(/waiting for signature/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument()
  })

  it('shows the signed state with no copy-link controls', () => {
    render(<ContractSection order={baseOrder({
      contractStatus: 'signed',
      contractToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      contractSignedName: 'Rick Adams',
    })} />)

    expect(screen.getByText(/signed by rick adams/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument()
  })

  it('shows "Send contract" for a confirmed order that has no contract yet', async () => {
    const user = userEvent.setup()
    render(<ContractSection order={baseOrder({ contractStatus: 'none', status: 'confirmed' })} />)

    await user.click(screen.getByRole('button', { name: /send contract/i }))
    expect(sendMock).toHaveBeenCalledWith('order-1')
  })

  it('hides the send button for an order still in "new" status', () => {
    render(<ContractSection order={baseOrder({ contractStatus: 'none', status: 'new' })} />)

    expect(screen.getByText(/not sent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send contract/i })).not.toBeInTheDocument()
  })
})
