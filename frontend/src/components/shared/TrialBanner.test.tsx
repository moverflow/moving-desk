import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import TrialBanner from './TrialBanner'

// Mock useSubscription to control trial state
vi.mock('@/hooks/useSettings', () => ({
  useSubscription: vi.fn(),
}))

import { useSubscription } from '@/hooks/useSettings'

function renderBanner() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TrialBanner /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TrialBanner (AC5)', () => {
  it('AC5 — hidden when daysLeft > 5', () => {
    vi.mocked(useSubscription).mockReturnValue({
      data: { plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString() },
    } as ReturnType<typeof useSubscription>)
    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })

  it('AC5 — shows banner when daysLeft <= 5', () => {
    vi.mocked(useSubscription).mockReturnValue({
      data: { plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
    } as ReturnType<typeof useSubscription>)
    renderBanner()
    expect(screen.getByText(/days left in your trial/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upgrade now/i })).toBeInTheDocument()
  })

  it('AC6 — shows expired banner when trial ended', () => {
    vi.mocked(useSubscription).mockReturnValue({
      data: { plan: 'trial', status: 'trialing', trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    } as ReturnType<typeof useSubscription>)
    renderBanner()
    expect(screen.getByText(/trial has ended/i)).toBeInTheDocument()
  })

  it('hidden when plan is not trial', () => {
    vi.mocked(useSubscription).mockReturnValue({
      data: { plan: 'pro', status: 'active' },
    } as ReturnType<typeof useSubscription>)
    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })
})
