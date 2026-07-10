import type { JSX } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { BookingFormData, BookingResult } from '@/types'
import { useBookingTenant } from '@/hooks/useBooking'
import BookingForm from '@/components/booking/BookingForm'
import BookingSuccess from '@/components/booking/BookingSuccess'
import { getPersonInitials, formatPhone } from '@/lib/utils'

interface CompletedBooking {
  result: BookingResult
  data: BookingFormData
}

export default function BookingPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>()
  const { data: tenant, isLoading, isError } = useBookingTenant(slug)
  const [completed, setCompleted] = useState<CompletedBooking | null>(null)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  if (isError || !tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">🚚</p>
        <h1 className="text-lg font-semibold text-gray-900">Booking page not found</h1>
        <p className="text-sm text-gray-500 mt-1">
          This booking link is invalid or is not currently active.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <header className="text-center pb-6 mb-6 border-b border-gray-100">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-16 w-16 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-semibold mx-auto">
                {getPersonInitials(tenant.name)}
              </div>
            )}
            <h1 className="text-xl font-semibold text-gray-900 mt-3">{tenant.name}</h1>
            {tenant.phone && (
              <a href={`tel:${tenant.phone}`} className="text-sm text-gray-500 block mt-1">
                {formatPhone(tenant.phone)}
              </a>
            )}
            {tenant.description && (
              <p className="text-sm text-gray-500 mt-2">{tenant.description}</p>
            )}
          </header>

          {completed ? (
            <BookingSuccess
              companyName={tenant.name}
              companyPhone={tenant.phone}
              moveDate={completed.data.moveDate}
              fromAddress={completed.data.fromAddress}
              toAddress={completed.data.toAddress}
              totalPrice={completed.result.totalPrice}
            />
          ) : (
            <BookingForm
              slug={slug}
              tenant={tenant}
              onSuccess={(result, data) => setCompleted({ result, data })}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Powered by MovingDesk</p>
      </div>
    </div>
  )
}
