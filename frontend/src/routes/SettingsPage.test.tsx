import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { useAuthStore } from '@/store/auth.store'
import type { TeamMember } from '@/types'

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
  useUploadLogo: vi.fn(),
  useTeam: vi.fn(),
  useInviteMember: vi.fn(),
  useRemoveMember: vi.fn(),
  useSubscription: vi.fn(),
}))

import {
  useSettings, useUpdateSettings, useUploadLogo,
  useTeam, useInviteMember, useRemoveMember, useSubscription,
} from '@/hooks/useSettings'

const MOCK_USER = { id: 'user-1', email: 'owner@example.com', name: 'John Smith', role: 'owner' }
const MOCK_TENANT = { id: 'tenant-1', name: 'Best Movers', plan: 'trial' }

const MOCK_SETTINGS = {
  companyName: 'Best & Pro Moving Service',
  logoUrl: null,
  timezone: 'America/Los_Angeles',
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
}

const MOCK_TEAM: TeamMember[] = [
  { id: 'user-1', name: 'John Smith', email: 'john@bestmovers.com', role: 'owner' },
  { id: 'user-2', name: 'Maria Garcia', email: 'maria@bestmovers.com', role: 'dispatcher' },
]

const MOCK_SUB = { plan: 'trial' as const, status: 'trialing' as const, trialEndsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString() }

function setupMocks() {
  vi.mocked(useSettings).mockReturnValue({ data: MOCK_SETTINGS } as ReturnType<typeof useSettings>)
  vi.mocked(useUpdateSettings).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(MOCK_SETTINGS), isPending: false } as unknown as ReturnType<typeof useUpdateSettings>)
  vi.mocked(useUploadLogo).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ url: '' }), isPending: false } as unknown as ReturnType<typeof useUploadLogo>)
  vi.mocked(useTeam).mockReturnValue({ data: MOCK_TEAM } as ReturnType<typeof useTeam>)
  vi.mocked(useInviteMember).mockReturnValue({
    mutate: vi.fn((_email, opts) => opts?.onSuccess?.({ message: 'Invite sent', email: _email })),
    isPending: false,
  } as unknown as ReturnType<typeof useInviteMember>)
  vi.mocked(useRemoveMember).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRemoveMember>)
  vi.mocked(useSubscription).mockReturnValue({ data: MOCK_SUB } as ReturnType<typeof useSubscription>)
}

function renderSettings() {
  useAuthStore.getState().setAuth(MOCK_USER, MOCK_TENANT)
  setupMocks()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Routes><Route path="*" element={<SettingsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
})

describe('SettingsPage', () => {
  it('renders three tab triggers', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /company/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /billing/i })).toBeInTheDocument()
  })

  it('Company tab is active by default', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /company/i })).toHaveAttribute('data-state', 'active')
  })

  it('AC2 — base rates section visible on company tab', async () => {
    renderSettings()
    await waitFor(() => expect(screen.getByText('Base rates')).toBeInTheDocument())
  })

  it('AC1 — logo upload input present on company tab', () => {
    renderSettings()
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('AC3 — team tab shows team members after click', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
    })
  })

  it('AC3 — team tab shows invite button', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
    })
  })

  it('AC5 — billing tab shows plan info', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /billing/i }))
    await waitFor(() => {
      expect(screen.getByText('Current plan')).toBeInTheDocument()
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })
  })

  it('AC3 — can invite a new team member', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => screen.getByPlaceholderText(/teammate/i))
    await user.type(screen.getByPlaceholderText(/teammate/i), 'new@team.com')
    await user.click(screen.getByRole('button', { name: /^invite$/i }))
    await waitFor(() => {
      expect(screen.getByText('Invite sent!')).toBeInTheDocument()
    })
  })
})
