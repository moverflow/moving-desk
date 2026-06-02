import type { JSX } from 'react'
import { useState } from 'react'
import type { Invoice, InvoiceStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/utils'
import { MOCK_COMPANY } from '@/hooks/useInvoices'
import { useUpdateInvoiceStatus, useSendInvoice } from '@/hooks/useInvoices'
import InvoiceActions from './InvoiceActions'

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
]

export default function InvoiceDetail({ invoice }: { invoice: Invoice }): JSX.Element {
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status)
  const [copied, setCopied] = useState(false)
  const { mutate: updateStatus, isPending: isSavePending } = useUpdateInvoiceStatus()
  const { mutate: send, isPending: isSendPending } = useSendInvoice()

  function handleCopy(): void {
    void navigator.clipboard.writeText(`${window.location.origin}/i/${invoice.shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSend(): void {
    send(invoice.id)
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{invoice.number}</h2>
          <p className="text-sm text-gray-500">Created {formatDate(new Date(invoice.createdAt))}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-medium text-gray-700 mb-1">{MOCK_COMPANY.name}</p>
          <p className="text-gray-500">{MOCK_COMPANY.phone}</p>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-1">{invoice.clientName}</p>
          <p className="text-gray-500">{invoice.clientPhone}</p>
        </div>
      </div>
      <div className="rounded-md border p-4 text-sm space-y-1">
        <p className="text-gray-500">{invoice.fromAddress} → {invoice.toAddress}</p>
        <p className="text-gray-500">Move date: {formatDate(new Date(invoice.moveDate))}</p>
        <p className="text-gray-500">{invoice.homeSize}{invoice.packing ? ' + Packing' : ''}</p>
      </div>
      <div className="rounded-md border p-4 text-sm space-y-2">
        <div className="flex justify-between"><span>Moving ({invoice.homeSize})</span><span>{formatCurrency(invoice.basePrice)}</span></div>
        {invoice.packing && <div className="flex justify-between"><span>Packing service</span><span>{formatCurrency(invoice.totalPrice - invoice.basePrice)}</span></div>}
        <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span>{formatCurrency(invoice.totalPrice)}</span></div>
      </div>
      <InvoiceActions invoice={invoice} company={MOCK_COMPANY} copied={copied} isSendPending={isSendPending} onCopy={handleCopy} onSend={handleSend} />
      <div className="flex items-end gap-3 pt-2 border-t">
        <div className="flex-1 space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => updateStatus({ id: invoice.id, status })} disabled={isSavePending}>
          {isSavePending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
