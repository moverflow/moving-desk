import type { JSX } from 'react'
import { ArrowRight, Calendar, Truck, User } from 'lucide-react'
import { formatCurrency, formatPhone } from '@/lib/utils'
import type { AssistantJob } from '@/types'
import { formatHomeSize, formatMoveDate, formatStatus, statusTone } from './format'

// A job rendered inline in the conversation, so the dispatcher reads the same
// facts they would see on the board instead of a paragraph describing them.
export default function JobCard({ job }: { job: AssistantJob }): JSX.Element {
  return (
    <article className="rounded-xl border border-black/10 bg-[var(--tg-bg)] p-3 text-left shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[var(--tg-hint)]">{job.reference}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone(job.status)}`}
        >
          {formatStatus(job.status)}
        </span>
      </header>

      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
        <User className="h-3.5 w-3.5 shrink-0 text-[var(--tg-hint)]" aria-hidden />
        {job.clientName ?? 'No client on file'}
      </p>
      {job.clientPhone && (
        <a
          href={`tel:${job.clientPhone.replace(/\D/g, '')}`}
          className="ml-5 text-xs text-[var(--tg-link)] underline"
        >
          {formatPhone(job.clientPhone)}
        </a>
      )}

      <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--tg-hint)]">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="break-words">
          {job.fromAddress} → {job.toAddress}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--tg-hint)]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {formatMoveDate(job.moveDate)}
        </span>
        <span>{formatHomeSize(job.homeSize)}</span>
        {job.packing && <span>Packing</span>}
        {job.crewName && (
          <span className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" aria-hidden />
            {job.crewName}
          </span>
        )}
        <span className="ml-auto font-semibold text-[var(--tg-text)]">
          {formatCurrency(job.totalPrice)}
        </span>
      </div>
    </article>
  )
}
