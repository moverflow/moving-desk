import type { JSX } from 'react'
import { formatDate, formatPhone } from '@/lib/utils'

interface BookingSuccessProps {
  companyName: string
  companyPhone: string | null
  moveDate: string
  fromAddress: string
  toAddress: string
}

export default function BookingSuccess({
  companyName,
  companyPhone,
  moveDate,
  fromAddress,
  toAddress,
}: BookingSuccessProps): JSX.Element {
  return (
    <div className="text-center py-6">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-xl font-semibold text-gray-900">Request received!</h2>
      <p className="text-sm text-gray-500 mt-2">
        Thank you. We received your moving request and will contact you shortly to confirm.
        {' '}{companyName} will be in touch within 1 business day.
      </p>

      <div className="mt-6 text-left rounded-lg border border-gray-200 divide-y divide-gray-100">
        <Row label="Move date" value={formatDate(new Date(`${moveDate}T00:00:00Z`))} />
        <Row label="From" value={fromAddress} />
        <Row label="To" value={toAddress} />
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
