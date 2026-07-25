import type { JSX } from 'react'
import type { Invoice } from '@/types'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatTimestamp } from '@/lib/utils'

interface InvoicePaymentStatusProps {
  invoice: Invoice
  onPay: () => void
  isPaying: boolean
  payError: string | null
}

export default function InvoicePaymentStatus({
  invoice,
  onPay,
  isPaying,
  payError,
}: InvoicePaymentStatusProps): JSX.Element | null {
  if (invoice.status === 'paid') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="font-semibold text-green-700">✅ Payment received</p>
        {invoice.paidAt && (
          <p className="text-sm text-green-600">Paid on {formatTimestamp(new Date(invoice.paidAt))}</p>
        )}
      </div>
    )
  }

  if (invoice.status === 'refunded') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="font-semibold text-amber-700">This payment was refunded</p>
      </div>
    )
  }

  if (invoice.status === 'disputed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="font-semibold text-red-700">This charge is under dispute</p>
      </div>
    )
  }

  if (invoice.status === 'sent') {
    return (
      <div className="rounded-lg border p-4 space-y-3 text-center">
        <p className="text-sm text-gray-500">Total due</p>
        <p className="text-2xl font-bold">{formatCurrency(invoice.totalPrice)}</p>
        <Button className="w-full" onClick={onPay} disabled={isPaying}>
          {isPaying ? 'Redirecting…' : `💳 Pay now — ${formatCurrency(invoice.totalPrice)}`}
        </Button>
        {payError && <p className="text-sm text-red-600">{payError}</p>}
        <p className="text-xs text-gray-400">Secure payment powered by Stripe</p>
      </div>
    )
  }

  return null
}
