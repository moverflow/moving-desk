import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { AppNotification } from '@/types'
import NotificationBell from './NotificationBell'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/hooks/useNotifications', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useNotifications')>(
    '@/hooks/useNotifications',
  )
  return {
    ...actual,
    useNotifications: vi.fn(),
    useMarkNotificationRead: vi.fn(),
    useMarkAllNotificationsRead: vi.fn(),
  }
})

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'

const markReadMock = vi.fn()
const markAllReadMock = vi.fn()

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n-1',
    type: 'invoice_paid',
    title: 'Invoice INV-1089 paid',
    body: '$480 received from Rick Adams',
    relatedType: 'invoice',
    relatedId: 'invoice-1',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function setNotifications(notifications: AppNotification[], unreadCount: number): void {
  vi.mocked(useNotifications).mockReturnValue({
    data: { notifications, unreadCount },
  } as ReturnType<typeof useNotifications>)
}

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  markReadMock.mockReset()
  markAllReadMock.mockReset()
  vi.mocked(useMarkNotificationRead).mockReturnValue({
    mutate: markReadMock,
    isPending: false,
  } as unknown as ReturnType<typeof useMarkNotificationRead>)
  vi.mocked(useMarkAllNotificationsRead).mockReturnValue({
    mutate: markAllReadMock,
    isPending: false,
  } as unknown as ReturnType<typeof useMarkAllNotificationsRead>)
})

describe('NotificationBell', () => {
  it('AC3 — shows the unread count on the bell', () => {
    setNotifications([notification()], 3)
    renderBell()
    expect(screen.getByRole('button', { name: /3 unread/i })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('AC3 — caps the badge at 9+', () => {
    setNotifications([notification()], 24)
    renderBell()
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('hides the badge when nothing is unread', () => {
    setNotifications([notification({ readAt: new Date().toISOString() })], 0)
    renderBell()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('AC3 — opens a panel listing recent notifications', async () => {
    setNotifications([notification()], 1)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Invoice INV-1089 paid')).toBeInTheDocument()
    expect(screen.getByText('$480 received from Rick Adams')).toBeInTheDocument()
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('AC3 — clicking a notification marks it read and navigates to the record', async () => {
    setNotifications([notification()], 1)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByText('Invoice INV-1089 paid'))

    expect(markReadMock).toHaveBeenCalledWith('n-1')
    expect(navigateMock).toHaveBeenCalledWith('/invoices?invoice=invoice-1')
  })

  it('does not re-mark an already-read notification', async () => {
    setNotifications([notification({ readAt: '2026-07-24T10:00:00.000Z' })], 0)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByText('Invoice INV-1089 paid'))

    expect(markReadMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalled()
  })

  it('navigates an order notification to the order deep link', async () => {
    setNotifications([notification({ relatedType: 'order', relatedId: 'order-7', type: 'contract_signed' })], 1)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByText('Invoice INV-1089 paid'))

    expect(navigateMock).toHaveBeenCalledWith('/orders?order=order-7')
  })

  it('navigates a lead notification to the leads pipeline', async () => {
    setNotifications([notification({ relatedType: 'lead', relatedId: 'lead-3', type: 'lead_new' })], 1)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByText('Invoice INV-1089 paid'))

    expect(navigateMock).toHaveBeenCalledWith('/orders?tab=leads')
  })

  it('marks everything read from the panel header', async () => {
    setNotifications([notification()], 2)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByRole('button', { name: /mark all read/i }))

    expect(markAllReadMock).toHaveBeenCalled()
  })

  it('shows an empty state when there is nothing to show', async () => {
    setNotifications([], 0)
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument()
  })
})
