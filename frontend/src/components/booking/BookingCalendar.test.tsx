import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/hooks/useBooking', () => ({
  useBookingAvailability: vi.fn((_slug: string, month: string) => ({
    data: [`${month}-15`],
    isLoading: false,
  })),
}))

import BookingCalendar from './BookingCalendar'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

describe('BookingCalendar', () => {
  it('AC4 — renders available date as enabled and unavailable dates as disabled', () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    render(<BookingCalendar slug="acme" selectedDate={null} onSelect={vi.fn()} />)

    const available = screen.getByLabelText(`${month}-15`)
    expect(available).not.toBeDisabled()

    // day 20 is not in the available set → disabled
    const unavailable = screen.getByLabelText(`${month}-20`)
    expect(unavailable).toBeDisabled()
  })

  it('AC4 — clicking an available date calls onSelect with the ISO date', () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const onSelect = vi.fn()
    render(<BookingCalendar slug="acme" selectedDate={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByLabelText(`${month}-15`))
    expect(onSelect).toHaveBeenCalledWith(`${month}-15`)
  })

  it('AC5 — navigating to the next month fetches and shows that month availability', () => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonth = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`

    render(<BookingCalendar slug="acme" selectedDate={null} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Next month'))

    expect(screen.getByLabelText(`${nextMonth}-15`)).not.toBeDisabled()
  })
})
