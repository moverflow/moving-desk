import type { JSX } from 'react'
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice, Company } from '@/types'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/utils'
import { useCreatePaymentLink } from '@/hooks/useInvoices'
import InvoiceDocument from './InvoiceDocument'
import InvoiceMoveDetails from './InvoiceMoveDetails'
import InvoicePaymentStatus from './InvoicePaymentStatus'

interface PublicInvoiceContentProps {
  invoice: Invoice
  company: Company
}

function InvoiceHeader({ invoice, company }: PublicInvoiceContentProps): JSX.Element {
  return (
    <>
      <div>
        <p className="text-lg font-semibold">{company.name}</p>
        <p className="text-sm text-gray-500">{company.phone} · {company.website}</p>
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">Invoice</p>
          <p className="text-xl font-bold">{invoice.number}</p>
        </div>
        <p className="text-sm text-gray-500">{formatTimestamp(new Date(invoice.createdAt))}</p>
      </div>
      <div className="text-sm border-t pt-4">
        <p className="font-medium">{invoice.clientName} · {invoice.clientPhone}</p>
      </div>
    </>
  )
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
      <InvoiceHeader invoice={invoice} company={company} />
      <InvoiceMoveDetails invoice={invoice} />

      <InvoicePaymentStatus
        invoice={invoice}
        onPay={handlePay}
        isPaying={createPaymentLink.isPending}
        payError={payError}
      />

      <div className="flex gap-3 flex-wrap">
        <PDFDownloadLink document={<InvoiceDocument invoice={invoice} company={company} />} fileName={`${invoice.number}.pdf`}>
          {({ loading }) => <Button variant="outline" disabled={loading}>{loading ? 'Preparing...' : 'Download PDF'}</Button>}
        </PDFDownloadLink>
      </div>
    </div>
  )
}
