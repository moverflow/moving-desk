import type { JSX } from 'react'
import { ShieldAlert } from 'lucide-react'
import type { AssistantPendingAction } from '@/types'

const TOOL_LABELS: Record<AssistantPendingAction['tool'], string> = {
  createJob: 'Create a job',
  setJobStatus: 'Change a job status',
  listUpcomingJobs: 'Look up jobs',
  listUnpaidInvoices: 'Look up invoices',
  findClient: 'Look up clients',
}

interface PendingActionCardProps {
  action: AssistantPendingAction
  onConfirm: () => void
  onReject: () => void
  pending: boolean
}

// Nothing has been written when this renders. The assistant asked for a change
// and the backend is holding it — these two buttons are the only way it runs, so
// the card states plainly what will happen before the user commits.
export default function PendingActionCard({
  action,
  onConfirm,
  onReject,
  pending,
}: PendingActionCardProps): JSX.Element {
  return (
    <section
      aria-label="Confirm action"
      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-left"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        Needs your OK
      </p>

      <p className="mt-1.5 text-xs font-medium text-amber-900">{TOOL_LABELS[action.tool]}</p>
      <p className="mt-0.5 break-words text-sm text-amber-950">{action.summary}</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 rounded-lg bg-[var(--tg-button)] px-3 py-2 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
