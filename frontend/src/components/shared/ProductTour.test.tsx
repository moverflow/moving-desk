import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EventData, Props as JoyrideProps } from 'react-joyride'
import { EVENTS, STATUS } from 'react-joyride'
import ProductTour from './ProductTour'
import type { Settings } from '@/types'

const joyrideSpy = vi.fn()
let latestProps: JoyrideProps | null = null

vi.mock('react-joyride', async () => {
  const actual = await vi.importActual<typeof import('react-joyride')>('react-joyride')
  return {
    ...actual,
    Joyride: (props: JoyrideProps) => {
      joyrideSpy(props)
      latestProps = props
      return null
    },
  }
})

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}))

import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

const updateSettingsMock = vi.fn()

function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    companyName: 'Best Movers',
    logoUrl: null,
    timezone: 'America/New_York',
    baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
    packingFee: 120,
    phone: null,
    slug: 'best-movers',
    bookingEnabled: true,
    bookingDescription: null,
    contractTerms: null,
    hasSeenTour: false,
    ...overrides,
  }
}

function LocationDisplay(): null {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div> as unknown as null
}

function renderTour(settings: Settings | undefined, initialEntry = '/orders') {
  vi.mocked(useSettings).mockReturnValue({ data: settings } as unknown as ReturnType<typeof useSettings>)
  vi.mocked(useUpdateSettings).mockReturnValue({ mutate: updateSettingsMock } as unknown as ReturnType<typeof useUpdateSettings>)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="*" element={<><ProductTour /><LocationDisplayWrapper /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function LocationDisplayWrapper() {
  return <LocationDisplay />
}

beforeEach(() => {
  joyrideSpy.mockClear()
  updateSettingsMock.mockReset()
  latestProps = null
})

// The whole point of this task: the tour must show exactly once per tenant,
// never repeat automatically, and support a manual replay entry point.
describe('ProductTour — has-seen-tour flag behavior', () => {
  it('auto-starts when the tenant has not seen the tour yet', async () => {
    renderTour(baseSettings({ hasSeenTour: false }))

    await waitFor(() => {
      expect(joyrideSpy).toHaveBeenCalledWith(expect.objectContaining({ run: true }))
    })
  })

  it('does not auto-start once the tenant has already seen the tour', async () => {
    renderTour(baseSettings({ hasSeenTour: true }))

    await waitFor(() => {
      expect(joyrideSpy).toHaveBeenCalled()
    })
    expect(joyrideSpy).not.toHaveBeenCalledWith(expect.objectContaining({ run: true }))
  })

  it('persists hasSeenTour when the tour finishes', async () => {
    renderTour(baseSettings({ hasSeenTour: false }))
    await waitFor(() => expect(joyrideSpy).toHaveBeenCalledWith(expect.objectContaining({ run: true })))

    const onEvent = latestProps?.onEvent as (data: EventData) => void
    act(() => {
      onEvent({ type: EVENTS.TOUR_END, status: STATUS.FINISHED } as EventData)
    })

    expect(updateSettingsMock).toHaveBeenCalledWith({ hasSeenTour: true })
  })

  it('persists hasSeenTour when the tour is skipped', async () => {
    renderTour(baseSettings({ hasSeenTour: false }))
    await waitFor(() => expect(joyrideSpy).toHaveBeenCalledWith(expect.objectContaining({ run: true })))

    const onEvent = latestProps?.onEvent as (data: EventData) => void
    act(() => {
      onEvent({ type: EVENTS.TOUR_END, status: STATUS.SKIPPED } as EventData)
    })

    expect(updateSettingsMock).toHaveBeenCalledWith({ hasSeenTour: true })
  })

  it('never repeats automatically once already seen, even after re-render', async () => {
    const { rerender } = renderTour(baseSettings({ hasSeenTour: true }))
    await waitFor(() => expect(joyrideSpy).toHaveBeenCalled())
    joyrideSpy.mockClear()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/orders']}>
          <Routes>
            <Route path="*" element={<ProductTour />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(joyrideSpy).toHaveBeenCalled())
    expect(joyrideSpy).not.toHaveBeenCalledWith(expect.objectContaining({ run: true }))
  })

  it('replays manually via ?tour=replay even when already seen, and strips the param', async () => {
    renderTour(baseSettings({ hasSeenTour: true }), '/dashboard?tour=replay')

    await waitFor(() => {
      expect(joyrideSpy).toHaveBeenCalledWith(expect.objectContaining({ run: true }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).not.toContain('tour=replay')
    })
  })

  it('builds steps whose "before" hook navigates to the step\'s route', async () => {
    renderTour(baseSettings({ hasSeenTour: false }))
    await waitFor(() => expect(joyrideSpy).toHaveBeenCalled())

    const steps = latestProps?.steps ?? []
    expect(steps.length).toBeGreaterThan(1)

    // Fire-and-forget: navigate() runs synchronously as the first line of the
    // hook, before it starts polling for the target DOM node (which this test
    // never renders) — no need to await that poll's full timeout.
    act(() => {
      void steps[1].before?.({} as never)
    })

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/settings?tab=company')
    })
  })
})
