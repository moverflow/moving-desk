import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamTab from './TeamTab'
import type { TeamMember } from '@/types'

vi.mock('@/hooks/useSettings', () => ({
  useTeam: vi.fn(),
  useInviteMember: vi.fn(),
  useRemoveMember: vi.fn(),
}))

vi.mock('@/hooks/useCrews', () => ({
  useCrews: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'owner' } }),
}))

import { useTeam, useInviteMember, useRemoveMember } from '@/hooks/useSettings'

const MOCK_TEAM: TeamMember[] = [
  { id: 'user-1', name: 'Owner', email: 'owner@example.com', role: 'owner' },
]

const inviteMock = vi.fn()
const removeMock = vi.fn()

function setupMocks(): void {
  vi.mocked(useTeam).mockReturnValue({ data: MOCK_TEAM } as unknown as ReturnType<typeof useTeam>)
  vi.mocked(useRemoveMember).mockReturnValue({ mutate: removeMock, isPending: false } as unknown as ReturnType<typeof useRemoveMember>)
  vi.mocked(useInviteMember).mockReturnValue({ mutate: inviteMock, isPending: false } as unknown as ReturnType<typeof useInviteMember>)
}

beforeEach(() => {
  inviteMock.mockReset()
  removeMock.mockReset()
  setupMocks()
})

async function sendInvite(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText(/teammate/i), 'dispatcher@example.com')
  await user.click(screen.getByRole('button', { name: /send invite/i }))
}

// The whole point of this task: after "Send invite" succeeds, the join link
// must be shown with a Copy button — the owner's only fallback if email
// delivery fails or Resend isn't configured.
describe('TeamTab — invite copy-link fallback', () => {
  it('shows the invite link with a Copy link button once the invite succeeds', async () => {
    inviteMock.mockImplementation((_input, opts) => {
      opts.onSuccess({ message: 'Invite sent', email: 'dispatcher@example.com', token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    })
    const user = userEvent.setup()
    render(<TeamTab />)

    await sendInvite(user)

    expect(await screen.findByText(/invite sent to dispatcher@example\.com/i)).toBeInTheDocument()
    expect(screen.getByText(/join\?token=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })

  it('copies the invite link to the clipboard and shows confirmation', async () => {
    inviteMock.mockImplementation((_input, opts) => {
      opts.onSuccess({ message: 'Invite sent', email: 'dispatcher@example.com', token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    })
    const user = userEvent.setup()
    render(<TeamTab />)

    await sendInvite(user)
    await user.click(await screen.findByRole('button', { name: /copy link/i }))

    expect(await navigator.clipboard.readText()).toContain('token=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeInTheDocument()
  })

  it('stays visible with no auto-hide — the owner may need time to copy it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    inviteMock.mockImplementation((_input, opts) => {
      opts.onSuccess({ message: 'Invite sent', email: 'dispatcher@example.com', token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    })
    const user = userEvent.setup({ delay: null })
    render(<TeamTab />)

    await sendInvite(user)
    await screen.findByText(/invite sent to dispatcher@example\.com/i)

    vi.advanceTimersByTime(60_000)
    expect(screen.getByText(/invite sent to dispatcher@example\.com/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('surfaces the backend error message when the invite fails', async () => {
    inviteMock.mockImplementation((_input, opts) => {
      opts.onError(new Error('User limit reached'))
    })
    const user = userEvent.setup()
    render(<TeamTab />)

    await sendInvite(user)

    expect(await screen.findByText(/failed to send invite/i)).toBeInTheDocument()
  })

  it('requires a crew to be selected before inviting a crew member', async () => {
    const user = userEvent.setup()
    render(<TeamTab />)

    await user.type(screen.getByPlaceholderText(/teammate/i), 'crew@example.com')
    await user.selectOptions(screen.getByLabelText(/role/i), 'crew')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    expect(await screen.findByText(/select a crew/i)).toBeInTheDocument()
    expect(inviteMock).not.toHaveBeenCalled()
  })
})
