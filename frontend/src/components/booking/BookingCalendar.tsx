import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import { useBookingAvailability } from '@/hooks/useBooking'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface BookingCalendarProps {
  slug: string
  selectedDate: string | null
  onSelect: (date: string) => void
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function BookingCalendar({
  slug,
  selectedDate,
  onSelect,
}: BookingCalendarProps): JSX.Element {
  const now = new Date()
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const monthKey = `${view.year}-${pad(view.month)}`
  const { data: availableDates = [], isLoading } = useBookingAvailability(slug, monthKey)
  const availableSet = useMemo(() => new Set(availableDates), [availableDates])
  const today = todayIso()

  const grid = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(view.year, view.month - 1, 1))
    const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7 // Monday-first offset
    const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthKey}-${pad(d)}`)
    return cells
  }, [view, monthKey])

  function shift(delta: number): void {
    setView((prev) => {
      const next = prev.month - 1 + delta
      return { year: prev.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 + 1 }
    })
  }

  const canGoBack = monthKey > today.slice(0, 7)

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {MONTH_NAMES[view.month - 1]} {view.year}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((iso, idx) => {
          if (iso === null) return <div key={`empty-${idx}`} />
          const dayNum = Number(iso.slice(-2))
          const isAvailable = availableSet.has(iso) && !isLoading
          const isSelected = iso === selectedDate
          return (
            <button
              key={iso}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelect(iso)}
              aria-label={iso}
              aria-pressed={isSelected}
              className={cn(
                'h-9 rounded-md text-sm transition-colors',
                isSelected && 'bg-gray-900 text-white font-semibold',
                !isSelected && isAvailable && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                !isAvailable && 'text-gray-300 cursor-not-allowed',
              )}
            >
              {dayNum}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <p className="text-center text-xs text-gray-400 mt-3">Loading availability…</p>
      )}
    </div>
  )
}
