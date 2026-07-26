import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BookingTab from './BookingTab'
import type { Settings } from '@/types'

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}))

import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

const saveMock = vi.fn()

function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    companyName: 'Best Movers',
    logoUrl: null,
    timezone: 'America/New_York',
    baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
    packingFee: 120,
    phone: null,
    slug: 'best-movers',
    bookingEnabled: false,
    bookingDescription: null,
    contractTerms: null,
    hasSeenTour: false,
    ...overrides,
  }
}

function renderTab(settings: Settings) {
  vi.mocked(useSettings).mockReturnValue({ data: settings } as ReturnType<typeof useSettings>)
  vi.mocked(useUpdateSettings).mockReturnValue({
    mutateAsync: saveMock,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateSettings>)
  return render(<BookingTab />)
}

describe('BookingTab', () => {
  beforeEach(() => {
    saveMock.mockReset()
  })

  it('disables Copy link and Open, and shows an inline explanation, when booking is not enabled', () => {
    renderTab(baseSettings({ bookingEnabled: false }))

    expect(screen.getByRole('button', { name: /copy link/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /open/i })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /open/i })).not.toBeInTheDocument()
    expect(screen.getByText(/enable booking above to activate this link/i)).toBeInTheDocument()
  })

  it('enables Copy link and a real Open link, with no warning, once booking is enabled', () => {
    renderTab(baseSettings({ bookingEnabled: true }))

    expect(screen.getByRole('button', { name: /copy link/i })).toBeEnabled()
    const openLink = screen.getByRole('link', { name: /open/i })
    expect(openLink).toHaveAttribute('href', expect.stringContaining('/book/best-movers'))
    expect(screen.queryByText(/enable booking above to activate this link/i)).not.toBeInTheDocument()
  })

  it('keeps the link disabled while the switch is flipped on but not yet saved', () => {
    renderTab(baseSettings({ bookingEnabled: false }))

    fireEvent.click(screen.getByRole('switch', { name: /enable booking page/i }))

    // The toggle is local/unsaved state — the persisted value (what actually
    // controls whether /book/:slug works) hasn't changed, so the link must
    // still read as disabled until Save actually takes effect.
    expect(screen.getByRole('button', { name: /copy link/i })).toBeDisabled()
    expect(screen.getByText(/enable booking above to activate this link/i)).toBeInTheDocument()
  })

  it('saves the toggled enabled state on Save changes', async () => {
    renderTab(baseSettings({ bookingEnabled: false }))

    fireEvent.click(screen.getByRole('switch', { name: /enable booking page/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ bookingEnabled: true }))
  })
})
