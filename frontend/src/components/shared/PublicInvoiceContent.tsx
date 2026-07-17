import type { JSX } from 'react'
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice, Company } from '@/types'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCreatePaymentLink } from '@/hooks/useInvoices'
import InvoiceDocument from './InvoiceDocument'
import InvoiceMoveDetails from './InvoiceMoveDetails'

interface PublicInvoiceContentProps {
  invoice: Invoice
  company: Company
}

export default function PublicInvoiceContent({ invoice, company }: PublicInvoiceContentProps): JSX.Element {
  const createPaymentLink = useCreatePaymentLink()
  const [payError, setPayError] = useState<string | null>(null)

  async function handlePay(): Promise<void> {
    setPayError(null)
    try {
      const checkoutUrl = await createPaymentLink.mutateAsync(invoice.shareToken)
      window.location.href = checkoutUrl
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start payment. Please try again.')
    }
  }

  return (
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
      <div className="text-sm border-t pt-4">
        <p className="font-medium">{invoice.clientName} · {invoice.clientPhone}</p>
      </div>
      <InvoiceMoveDetails invoice={invoice} />

      {invoice.status === 'paid' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="font-semibold text-green-700">✅ Payment received</p>
          {invoice.paidAt && (
            <p className="text-sm text-green-600">Paid on {formatDate(new Date(invoice.paidAt))}</p>
          )}
        </div>
      )}

      {invoice.status === 'sent' && (
        <div className="rounded-lg border p-4 space-y-3 text-center">
          <p className="text-sm text-gray-500">Total due</p>
          <p className="text-2xl font-bold">{formatCurrency(invoice.totalPrice)}</p>
          <Button className="w-full" onClick={handlePay} disabled={createPaymentLink.isPending}>
            {createPaymentLink.isPending ? 'Redirecting…' : `💳 Pay now — ${formatCurrency(invoice.totalPrice)}`}
          </Button>
          {payError && <p className="text-sm text-red-600">{payError}</p>}
          <p className="text-xs text-gray-400">Secure payment powered by Stripe</p>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <PDFDownloadLink document={<InvoiceDocument invoice={invoice} company={company} />} fileName={`${invoice.number}.pdf`}>
          {({ loading }) => <Button variant="outline" disabled={loading}>{loading ? 'Preparing...' : 'Download PDF'}</Button>}
        </PDFDownloadLink>
      </div>
    </div>
  )
}
