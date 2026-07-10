import type { JSX } from 'react'
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils'

interface BookingSuccessProps {
  companyName: string
  companyPhone: string | null
  moveDate: string
  fromAddress: string
  toAddress: string
  totalPrice: number
}

export default function BookingSuccess({
  companyName,
  companyPhone,
  moveDate,
  fromAddress,
  toAddress,
  totalPrice,
}: BookingSuccessProps): JSX.Element {
  return (
    <div className="text-center py-6">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-xl font-semibold text-gray-900">You&apos;re booked!</h2>
      <p className="text-sm text-gray-500 mt-2">
        {companyName} will be in touch to confirm your move.
      </p>

      <div className="mt-6 text-left rounded-lg border border-gray-200 divide-y divide-gray-100">
        <Row label="Move date" value={formatDate(new Date(`${moveDate}T00:00:00Z`))} />
        <Row label="From" value={fromAddress} />
        <Row label="To" value={toAddress} />
        <Row label="Estimated price" value={formatCurrency(totalPrice)} />
      </div>

      {companyPhone && (
        <p className="text-sm text-gray-500 mt-6">
          Questions? Call us:{' '}
          <a href={`tel:${companyPhone}`} className="font-medium text-gray-900">
            {formatPhone(companyPhone)}
          </a>
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  )
}
