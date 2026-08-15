import type { JSX } from 'react'
import { useBookingTenant } from '@/hooks/useBooking'
import BookingCard from '@/features/booking-miniapp/BookingCard'
import { useTelegramTenantSlug } from '@/features/booking-miniapp/useTelegramTenantSlug'

// The client-facing Telegram Mini App: the same booking request as /book/:slug,
// opened from a company's Telegram link instead of their web page. Public and
// anonymous — there is no MovingDesk account behind it, so nothing here reads or
// verifies initData; the slug alone scopes the request, exactly as the URL path
// param does on the web.

function Notice({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-white">
      <p className="text-4xl mb-3">🚚</p>
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1 max-w-[320px]">{body}</p>
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div
        role="status"
        aria-label="Loading"
        className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
      />
    </div>
  )
}

export default function BookingMiniAppPage(): JSX.Element {
  const slug = useTelegramTenantSlug()
  const { data: tenant, isLoading, isError } = useBookingTenant(slug ?? '')

  if (slug === null || (slug !== '' && isLoading)) return <Spinner />

  if (slug === '') {
    return (
      <Notice
        title="No company in this link"
        body="Open the booking link your moving company sent you, or ask them for a new one."
      />
    )
  }

  // Covers both halves of "not available": getPublicTenant returns null for an
  // unknown slug and for a tenant with booking switched off, so the API answers
  // 404 either way and the client cannot tell them apart.
  if (isError || !tenant) {
    return (
      <Notice
        title="Booking not available"
        body="This booking link is invalid, or this company is not taking online bookings right now."
      />
    )
  }

  return (
    // The page scrolls rather than filling a fixed height, so it needs the
    // bottom inset as padding: without it the last field and the footer end up
    // under Telegram's chrome with no way to scroll them clear.
    <main className="min-h-screen bg-gray-50 px-4 pt-6 pb-[calc(1.5rem+var(--tg-safe-bottom))]">
      <div className="mx-auto w-full max-w-[560px]">
        <BookingCard slug={slug} tenant={tenant} />
        <p className="text-center text-xs text-gray-400 mt-4">Powered by MovingDesk</p>
      </div>
    </main>
  )
}
