import type { JSX } from 'react'
import { formatCurrency, formatPhone } from '@/lib/utils'
import type { AssistantInvoice } from '@/types'
import { formatMoveDate, formatStatus, statusTone } from './format'

export default function InvoiceCard({ invoice }: { invoice: AssistantInvoice }): JSX.Element {
  return (
    <article className="rounded-xl border border-black/10 bg-[var(--tg-bg)] p-3 text-left shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[var(--tg-hint)]">#{invoice.number}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone(invoice.status)}`}
        >
          {formatStatus(invoice.status)}
        </span>
      </header>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{invoice.clientName ?? 'No client on file'}</p>
        <p className="text-base font-semibold">{formatCurrency(invoice.totalPrice)}</p>
      </div>

      {invoice.clientPhone && (
        <a
          href={`tel:${invoice.clientPhone.replace(/\D/g, '')}`}
          className="text-xs text-[var(--tg-link)] underline"
        >
          {formatPhone(invoice.clientPhone)}
        </a>
      )}

      <p className="mt-2 text-xs text-[var(--tg-hint)]">
        Move {formatMoveDate(invoice.moveDate)} · {invoice.dueLabel}
      </p>
    </article>
  )
}
