import type { JSX } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice, Company } from '@/types'
import { Button } from '@/components/ui/button'
import InvoiceDocument from './InvoiceDocument'

interface InvoiceActionsProps {
  invoice: Invoice
  company: Company
  copied: boolean
  isSendPending: boolean
  onCopy: () => void
  onSend: () => void
}

export default function InvoiceActions({ invoice, company, copied, isSendPending, onCopy, onSend }: InvoiceActionsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <PDFDownloadLink
        document={<InvoiceDocument invoice={invoice} company={company} />}
        fileName={`${invoice.number}.pdf`}
      >
        {({ loading }) => (
          <Button variant="outline" size="sm" disabled={loading}>
            {loading ? 'Preparing...' : 'Download PDF'}
          </Button>
        )}
      </PDFDownloadLink>
      <Button
        variant="outline"
        size="sm"
        disabled={invoice.status !== 'draft' || isSendPending}
        onClick={onSend}
      >
        {isSendPending ? 'Sending...' : 'Send to client'}
      </Button>
      <Button variant="outline" size="sm" onClick={onCopy}>
        {copied ? 'Copied!' : 'Copy share link'}
      </Button>
    </div>
  )
}
