import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TelegramWebApp } from '@/lib/telegramWebApp'
import BookingMiniAppPage from './BookingMiniAppPage'

vi.mock('@/lib/telegramWebApp', () => ({
  loadTelegramWebApp: vi.fn(),
}))

// The whole point of the feature is that this Mini App is another client of the
// same booking hooks the web page uses, so they are mocked rather than replaced:
// the tests assert which slug reaches them and what gets posted.
vi.mock('@/hooks/useBooking', () => ({
  useBookingTenant: vi.fn(),
  useBookingAvailability: vi.fn(),
  useCreateBooking: vi.fn(),
}))

import { loadTelegramWebApp } from '@/lib/telegramWebApp'
import { useBookingAvailability, useBookingTenant, useCreateBooking } from '@/hooks/useBooking'

const TENANT = {
  name: 'Best Movers',
  logoUrl: null,
  phone: '(949) 555-0100',
  description: 'Family owned since 2010',
  slug: 'best-movers',
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
  packingFee: 120,
}

const createBookingMock = vi.fn()

function bridge(startParam?: string): TelegramWebApp {
  return {
    initData: 'user=%7B%7D&hash=abc',
    ...(startParam === undefined ? {} : { initDataUnsafe: { start_param: startParam } }),
    colorScheme: 'light',
    themeParams: {},
    ready: vi.fn(),
    expand: vi.fn(),
  }
}

// A date in the month the calendar opens on, so it is selectable without paging.
function availableDate(): string {
  const now = new Date()
  const day = now.getDate() < 28 ? now.getDate() + 1 : now.getDate()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface SetupOptions {
  startParam?: string
  tenant?: typeof TENANT | undefined
  isLoading?: boolean
  isError?: boolean
  hasBridge?: boolean
}

function setup(options: SetupOptions = {}): void {
  vi.mocked(loadTelegramWebApp).mockResolvedValue(
    options.hasBridge === false ? null : bridge(options.startParam ?? 'best-movers'),
  )

  vi.mocked(useBookingTenant).mockReturnValue({
    data: 'tenant' in options ? options.tenant : TENANT,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
  } as unknown as ReturnType<typeof useBookingTenant>)

  vi.mocked(useBookingAvailability).mockReturnValue({
    data: [availableDate()],
    isLoading: false,
  } as unknown as ReturnType<typeof useBookingAvailability>)

  vi.mocked(useCreateBooking).mockReturnValue({
    mutateAsync: createBookingMock,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateBooking>)
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <BookingMiniAppPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  createBookingMock.mockReset()
  createBookingMock.mockResolvedValue({ success: true, leadId: 'lead-1', confirmationMessage: 'ok' })
})

describe('BookingMiniAppPage — tenant resolution', () => {
  // AC: opening t.me/<bot>/book?startapp=<slug> shows a form scoped to that tenant,
  // with no login step in the way.
  it('scopes the booking form to the slug from start_param', async () => {
    setup({ startParam: 'best-movers' })
    renderPage()

    expect(await screen.findByRole('heading', { name: /book your move/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Best Movers' })).toBeInTheDocument()
    expect(useBookingTenant).toHaveBeenCalledWith('best-movers')
    expect(screen.queryByLabelText(/connect code/i)).not.toBeInTheDocument()
  })

  it('accepts the book_ prefixed form of the same parameter', async () => {
    setup({ startParam: 'book_best-movers' })
    renderPage()

    await screen.findByRole('heading', { name: /book your move/i })
    expect(useBookingTenant).toHaveBeenCalledWith('best-movers')
  })

  it('says so when the link carries no company', async () => {
    setup({ hasBridge: false })
    renderPage()

    expect(await screen.findByText(/no company in this link/i)).toBeInTheDocument()
  })
})

describe('BookingMiniAppPage — not available', () => {
  // AC: an invalid slug, or a tenant with booking_enabled=false, must land on a
  // clear state. The API answers 404 for both, so both arrive here as isError.
  it('shows the not-available state when the tenant does not resolve', async () => {
    setup({ isError: true, tenant: undefined })
    renderPage()

    expect(await screen.findByText(/booking not available/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /book your move/i })).not.toBeInTheDocument()
  })

  it('does not render a half-built form while the tenant is still loading', async () => {
    setup({ isLoading: true, tenant: undefined })
    renderPage()

    expect(await screen.findByRole('status', { name: /loading/i })).toBeInTheDocument()
    expect(screen.queryByText(/booking not available/i)).not.toBeInTheDocument()
  })
})

describe('BookingMiniAppPage — submission', () => {
  // AC: submitting creates a lead through the same booking flow as the web page.
  it('posts the booking through the shared hook, scoped to the start_param slug', async () => {
    setup()
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: /book your move/i })
    await user.type(screen.getByLabelText(/phone/i), '(714) 555-0199')
    await user.type(screen.getByLabelText(/^name/i), 'Jane Client')
    await user.type(screen.getByLabelText(/from address/i), 'Lake Forest, CA')
    await user.type(screen.getByLabelText(/to address/i), 'Anaheim, CA')
    await user.click(screen.getByLabelText(availableDate()))
    await user.click(screen.getByRole('button', { name: /book my move/i }))

    expect(useCreateBooking).toHaveBeenCalledWith('best-movers')
    expect(createBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Jane Client',
        clientPhone: '(714) 555-0199',
        fromAddress: 'Lake Forest, CA',
        toAddress: 'Anaheim, CA',
        moveDate: availableDate(),
        homeSize: '2br',
      }),
    )
  })

  it('confirms the request instead of leaving the form on screen', async () => {
    setup()
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: /book your move/i })
    await user.type(screen.getByLabelText(/phone/i), '(714) 555-0199')
    await user.type(screen.getByLabelText(/^name/i), 'Jane Client')
    await user.type(screen.getByLabelText(/from address/i), 'Lake Forest, CA')
    await user.type(screen.getByLabelText(/to address/i), 'Anaheim, CA')
    await user.click(screen.getByLabelText(availableDate()))
    await user.click(screen.getByRole('button', { name: /book my move/i }))

    expect(await screen.findByText(/request received/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /book my move/i })).not.toBeInTheDocument()
  })
})
