import type { JSX } from 'react'
import { useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice, Company } from '@/types'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import InvoiceDocument from './InvoiceDocument'
import InvoiceMoveDetails from './InvoiceMoveDetails'

interface PublicInvoiceContentProps {
  invoice: Invoice
  company: Company
}

export default function PublicInvoiceContent({ invoice, company }: PublicInvoiceContentProps): JSX.Element {
  const [received, setReceived] = useState(false)

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
      <div className="flex gap-3 flex-wrap">
        <PDFDownloadLink document={<InvoiceDocument invoice={invoice} company={company} />} fileName={`${invoice.number}.pdf`}>
          {({ loading }) => <Button variant="outline" disabled={loading}>{loading ? 'Preparing...' : 'Download PDF'}</Button>}
        </PDFDownloadLink>
        {!received
          ? <Button onClick={() => setReceived(true)}>Mark as received</Button>
          : <p className="text-sm text-green-600 self-center font-medium">Thank you!</p>}
      </div>
    </div>
  )
}
