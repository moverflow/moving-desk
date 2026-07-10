import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { forwardRef, useImperativeHandle } from 'react'
import type { ReactNode } from 'react'
import SchedulePage from './SchedulePage'
import type { Order, OrderStatus } from '@/types'

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
}))

import { useOrders } from '@/hooks/useOrders'

interface MockEvent {
  id: string
  title: string
  date: string
  backgroundColor: string
  borderColor: string
  extendedProps: Record<string, unknown>
}

interface MockFullCalendarProps {
  events: MockEvent[]
  editable: boolean
  selectable: boolean
  eventClick: (arg: { event: { title: string; extendedProps: Record<string, unknown> } }) => void
  headerToolbar?: Record<string, string>
}

const mockState = vi.hoisted(() => ({
  changeView: vi.fn(),
  lastProps: undefined as MockFullCalendarProps | undefined,
}))

vi.mock('@fullcalendar/react', () => ({
  default: forwardRef<{ getApi: () => { changeView: typeof mockState.changeView } }, MockFullCalendarProps>(
    (props, ref) => {
      useImperativeHandle(ref, () => ({ getApi: () => ({ changeView: mockState.changeView }) }))
      mockState.lastProps = props
      return (
        <div data-testid="fullcalendar-mock">
          {props.events.map((e) => (
            <button
              key={e.id}
              type="button"
              data-testid={`fc-event-${e.id}`}
              onClick={() => props.eventClick({ event: { title: e.title, extendedProps: e.extendedProps } })}
            >
              {e.title}
            </button>
          ))}
        </div>
      )
    },
  ),
}))

vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))

function buildOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    tenantId: 'mock-tenant-1',
    clientName: 'Rick Adams',
    phone: '(949) 632-9557',
    fromAddress: 'Lake Forest, CA 92630',
    toAddress: 'Anaheim, CA 92801',
    moveDate: '2026-06-15',
    homeSize: '2br',
    status: 'new',
    crewName: 'Team A — Truck #3',
    fromFloor: 1,
    toFloor: 2,
    fromElevator: false,
    toElevator: true,
    packing: false,
    totalPrice: 480,
    createdAt: '2026-06-01T10:00:00Z',
    isOnline: false,
    ...overrides,
  }
}

const ALL_STATUSES: OrderStatus[] = ['new', 'confirmed', 'in_progress', 'completed', 'closed', 'cancelled']

const MOCK_ORDERS: Order[] = [
  buildOrder({ id: 'order-1', clientName: 'Rick Adams', homeSize: '2br', status: 'new' }),
  buildOrder({
    id: 'order-2',
    clientName: 'Tom Wilson',
    homeSize: 'house',
    status: 'confirmed',
    moveDate: '2026-06-20',
    crewName: undefined,
  }),
]

function renderSchedule(orders: Order[] = MOCK_ORDERS): ReturnType<typeof render> {
  vi.mocked(useOrders).mockReturnValue({ data: orders, isLoading: false } as ReturnType<typeof useOrders>)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/schedule']}>
          <Routes>
            <Route path="/schedule" element={children} />
            <Route path="/orders" element={<div>orders page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  return render(<SchedulePage />, { wrapper })
}

describe('SchedulePage', () => {
  it('renders FullCalendar when useOrders returns data', async () => {
    renderSchedule()
    await waitFor(() => {
      expect(screen.getByTestId('fullcalendar-mock')).toBeInTheDocument()
    })
  })

  it('maps each order to an event with "{clientName} — {homeSize label}" title', async () => {
    renderSchedule()
    await waitFor(() => {
      expect(screen.getByText('Rick Adams — 2 BR')).toBeInTheDocument()
      expect(screen.getByText('Tom Wilson — House')).toBeInTheDocument()
    })
  })

  it('sets date to the order moveDate', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fullcalendar-mock'))
    const events = mockState.lastProps?.events ?? []
    expect(events.find((e) => e.id === 'order-1')?.date).toBe('2026-06-15')
    expect(events.find((e) => e.id === 'order-2')?.date).toBe('2026-06-20')
  })

  it('sets backgroundColor per status for all 6 statuses, closed matching completed', async () => {
    const orders = ALL_STATUSES.map((status, i) =>
      buildOrder({ id: `order-${i}`, clientName: `Client ${i}`, status }),
    )
    renderSchedule(orders)
    await waitFor(() => screen.getByTestId('fullcalendar-mock'))
    const events = mockState.lastProps?.events ?? []
    const colorByStatus = new Map(events.map((e, i) => [ALL_STATUSES[i], e.backgroundColor]))
    for (const status of ALL_STATUSES) {
      expect(colorByStatus.get(status)).toBeTruthy()
    }
    expect(colorByStatus.get('closed')).toBe(colorByStatus.get('completed'))
    const uniqueColors = new Set(colorByStatus.values())
    expect(uniqueColors.size).toBe(5)
  })

  it('passes editable={false} and selectable={false} to FullCalendar', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fullcalendar-mock'))
    expect(mockState.lastProps?.editable).toBe(false)
    expect(mockState.lastProps?.selectable).toBe(false)
  })

  it('Week/Month toggle buttons exist and drive the calendar view API', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fullcalendar-mock'))
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument()
    const monthButton = screen.getByRole('button', { name: 'Month' })
    fireEvent.click(monthButton)
    await waitFor(() => {
      expect(mockState.changeView).toHaveBeenCalledWith('dayGridMonth')
    })
  })

  it('clicking an event opens the Sheet with client/home-size, addresses, crew, status, and a View order link', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fc-event-order-1'))
    fireEvent.click(screen.getByTestId('fc-event-order-1'))
    await waitFor(() => {
      expect(screen.getAllByText('Rick Adams — 2 BR').length).toBeGreaterThan(1)
      expect(screen.getByText('Lake Forest, CA 92630 → Anaheim, CA 92801')).toBeInTheDocument()
      expect(screen.getByText('Team A — Truck #3')).toBeInTheDocument()
      expect(screen.getByText('Status: New')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view order/i })).toBeInTheDocument()
    })
  })

  it('falls back to "Unassigned" when order has no crew', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fc-event-order-2'))
    fireEvent.click(screen.getByTestId('fc-event-order-2'))
    await waitFor(() => {
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })
  })

  it('"View order →" navigates to /orders', async () => {
    renderSchedule()
    await waitFor(() => screen.getByTestId('fc-event-order-1'))
    fireEvent.click(screen.getByTestId('fc-event-order-1'))
    await waitFor(() => screen.getByRole('link', { name: /view order/i }))
    fireEvent.click(screen.getByRole('link', { name: /view order/i }))
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })
})
