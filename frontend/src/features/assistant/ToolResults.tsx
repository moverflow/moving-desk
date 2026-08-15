import type { JSX } from 'react'
import { AlertCircle } from 'lucide-react'
import type {
  AssistantClient,
  AssistantInvoice,
  AssistantJob,
  AssistantToolResult,
} from '@/types'
import ClientCard from './ClientCard'
import InvoiceCard from './InvoiceCard'
import JobCard from './JobCard'

// Turns a tool result into cards. `data` is whatever the backend's adapter
// returned, so each branch narrows it before rendering — a payload that does not
// match its tool is skipped rather than crashing the conversation.

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}

function EmptyResult({ label }: { label: string }): JSX.Element {
  return <p className="text-xs italic text-[var(--tg-hint)]">{label}</p>
}

function ResultBody({ result }: { result: AssistantToolResult }): JSX.Element | null {
  if (!result.ok) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-red-600">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{result.error ?? 'That did not work.'}</span>
      </p>
    )
  }

  switch (result.tool) {
    case 'listUpcomingJobs': {
      const jobs = asArray<AssistantJob>(result.data)
      if (jobs.length === 0) return <EmptyResult label="No jobs in that window." />
      return (
        <>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </>
      )
    }

    case 'listUnpaidInvoices': {
      const invoices = asArray<AssistantInvoice>(result.data)
      if (invoices.length === 0) return <EmptyResult label="No unpaid invoices." />
      return (
        <>
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </>
      )
    }

    case 'findClient': {
      const clients = asArray<AssistantClient>(result.data)
      if (clients.length === 0) return <EmptyResult label="No matching clients." />
      return (
        <>
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </>
      )
    }

    // Both writes answer with the job as it now stands.
    case 'createJob':
    case 'setJobStatus':
      return isRecord(result.data) ? <JobCard job={result.data as unknown as AssistantJob} /> : null
  }
}

export default function ToolResults({
  results,
}: {
  results: AssistantToolResult[]
}): JSX.Element | null {
  if (results.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      {results.map((result, index) => (
        <ResultBody key={`${result.tool}-${index}`} result={result} />
      ))}
    </div>
  )
}
