import type { JSX } from 'react'
import type { Invoice } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function InvoiceMoveDetails({ invoice }: { invoice: Invoice }): JSX.Element {
  return (
    <>
      <div className="rounded-md border p-4 text-sm space-y-1">
        <p className="text-gray-500">{invoice.fromAddress} → {invoice.toAddress}</p>
        <p className="text-gray-500">Move date: {formatDate(new Date(invoice.moveDate))}</p>
        <p className="text-gray-500">{invoice.homeSize}{invoice.packing ? ' + Packing' : ''}</p>
      </div>
      <div className="rounded-md border p-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span>Moving ({invoice.homeSize})</span>
          <span>{formatCurrency(invoice.basePrice)}</span>
        </div>
        {invoice.packing && (
          <div className="flex justify-between">
            <span>Packing service</span>
            <span>{formatCurrency(invoice.totalPrice - invoice.basePrice)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold pt-2 border-t">
          <span>Total</span>
          <span>{formatCurrency(invoice.totalPrice)}</span>
        </div>
      </div>
    </>
  )
}
