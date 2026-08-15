import type { JSX } from 'react'
import { useState } from 'react'
import type { BookingFormData, BookingResult, PublicBookingTenant } from '@/types'
import BookingForm from '@/components/booking/BookingForm'
import BookingSuccess from '@/components/booking/BookingSuccess'
import { getPersonInitials, formatPhone } from '@/lib/utils'

interface CompletedBooking {
  result: BookingResult
  data: BookingFormData
}

function CompanyHeader({ tenant }: { tenant: PublicBookingTenant }): JSX.Element {
  return (
    <header className="text-center pb-5 mb-5 border-b border-gray-100">
      {tenant.logoUrl ? (
        <img
          src={tenant.logoUrl}
          alt={tenant.name}
          className="h-14 w-14 rounded-full object-cover mx-auto"
        />
      ) : (
        <div className="h-14 w-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-base font-semibold mx-auto">
          {getPersonInitials(tenant.name)}
        </div>
      )}
      <h1 className="text-lg font-semibold text-gray-900 mt-3">{tenant.name}</h1>
      {tenant.phone && (
        <a href={`tel:${tenant.phone}`} className="text-sm text-gray-500 block mt-1">
          {formatPhone(tenant.phone)}
        </a>
      )}
      {tenant.description && <p className="text-sm text-gray-500 mt-2">{tenant.description}</p>}
    </header>
  )
}

interface BookingCardProps {
  slug: string
  tenant: PublicBookingTenant
}

export default function BookingCard({ slug, tenant }: BookingCardProps): JSX.Element {
  const [completed, setCompleted] = useState<CompletedBooking | null>(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8">
      <CompanyHeader tenant={tenant} />

      {completed ? (
        <BookingSuccess
          companyName={tenant.name}
          companyPhone={tenant.phone}
          moveDate={completed.data.moveDate}
          fromAddress={completed.data.fromAddress}
          toAddress={completed.data.toAddress}
        />
      ) : (
        <BookingForm
          slug={slug}
          tenant={tenant}
          onSuccess={(result, data) => setCompleted({ result, data })}
        />
      )}
    </div>
  )
}
