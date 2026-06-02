import type { JSX } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import InvoiceDocument from '@/components/shared/InvoiceDocument'
import { usePublicInvoice } from '@/hooks/useInvoices'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function PublicInvoicePage(): JSX.Element {
  const { token = '' } = useParams<{ token: string }>()
  const { data, isLoading, isError } = usePublicInvoice(token)
  const [received, setReceived] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">This invoice link is invalid or has expired.</p>
      </div>
    )
  }

  const { invoice, company } = data

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6">
      <div className="bg-white rounded-lg border w-full max-w-lg p-8 space-y-6">
        <div>
          <p className="text-lg font-semibold">{company.name}</p>
          <p className="text-sm text-gray-500">{company.phone} · {company.website}</p>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">Invoice</p>
            <p className="text-xl font-bold">{invoice.number}</p>
          </div>
          <p className="text-sm text-gray-500">{formatDate(new Date(invoice.createdAt))}</p>
        </div>
        <div className="text-sm space-y-1 border-t pt-4">
          <p className="font-medium">{invoice.clientName} · {invoice.clientPhone}</p>
          <p className="text-gray-500">{invoice.fromAddress} → {invoice.toAddress}</p>
          <p className="text-gray-500">Move date: {formatDate(new Date(invoice.moveDate))}</p>
        </div>
        <div className="border rounded-md p-4 text-sm space-y-2">
          <div className="flex justify-between"><span>Moving ({invoice.homeSize})</span><span>{formatCurrency(invoice.basePrice)}</span></div>
          {invoice.packing && <div className="flex justify-between"><span>Packing</span><span>{formatCurrency(invoice.totalPrice - invoice.basePrice)}</span></div>}
          <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span>{formatCurrency(invoice.totalPrice)}</span></div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <PDFDownloadLink document={<InvoiceDocument invoice={invoice} company={company} />} fileName={`${invoice.number}.pdf`}>
            {({ loading }) => <Button variant="outline" disabled={loading}>{loading ? 'Preparing...' : 'Download PDF'}</Button>}
          </PDFDownloadLink>
          {!received
            ? <Button onClick={() => setReceived(true)}>Mark as received</Button>
            : <p className="text-sm text-green-600 self-center font-medium">Thank you!</p>
          }
        </div>
      </div>
    </div>
  )
}
