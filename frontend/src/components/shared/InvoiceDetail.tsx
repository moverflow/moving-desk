import type { JSX } from 'react'
import { useState } from 'react'
import type { Invoice } from '@/types'
import { formatDate } from '@/lib/utils'
import { useSendInvoice } from '@/hooks/useInvoices'
import { useSettings } from '@/hooks/useSettings'
import InvoiceActions from './InvoiceActions'
import InvoiceMoveDetails from './InvoiceMoveDetails'
import InvoiceStatusSelect from './InvoiceStatusSelect'

export default function InvoiceDetail({ invoice }: { invoice: Invoice }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const { mutate: send, isPending: isSendPending } = useSendInvoice()
  const { data: settings } = useSettings()
  const companyName = settings?.companyName ?? ''

  function handleCopy(): void {
    void navigator.clipboard.writeText(`${window.location.origin}/i/${invoice.shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">{invoice.number}</h2>
        <p className="text-sm text-gray-500">Created {formatDate(new Date(invoice.createdAt))}</p>
      </div>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-medium text-gray-700 mb-1">{companyName}</p>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-1">{invoice.clientName}</p>
          <p className="text-gray-500">{invoice.clientPhone}</p>
        </div>
      </div>
      <InvoiceMoveDetails invoice={invoice} />
      <InvoiceActions
        invoice={invoice}
        company={{ name: companyName, phone: '', website: '', logoUrl: settings?.logoUrl ?? null }}
        copied={copied}
        isSendPending={isSendPending}
        onCopy={handleCopy}
        onSend={() => send(invoice.id)}
      />
      <InvoiceStatusSelect id={invoice.id} currentStatus={invoice.status} />
    </div>
  )
}
