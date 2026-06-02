import type { JSX } from 'react'
import type { Invoice, InvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft', sent: 'Sent', paid: 'Paid',
}

interface InvoiceListItemProps {
  invoice: Invoice
  selected: boolean
  onClick: () => void
}

export default function InvoiceListItem({ invoice, selected, onClick }: InvoiceListItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
        selected && 'bg-gray-50 border-l-2 border-l-gray-900',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{invoice.number}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[invoice.status])}>
          {STATUS_LABEL[invoice.status]}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{invoice.clientName}</p>
      <p className="text-xs text-gray-400 mt-0.5">{invoice.moveDate}</p>
    </button>
  )
}
