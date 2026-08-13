import type { JSX } from 'react'
import { formatPhone, getPersonInitials } from '@/lib/utils'
import type { AssistantClient } from '@/types'

export default function ClientCard({ client }: { client: AssistantClient }): JSX.Element {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-black/10 bg-[var(--tg-bg)] p-3 text-left shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tg-secondary-bg)] text-xs font-semibold">
        {getPersonInitials(client.name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{client.name}</p>
        <p className="truncate text-xs text-[var(--tg-hint)]">
          {client.phone ? formatPhone(client.phone) : 'No phone'}
          {client.email ? ` · ${client.email}` : ''}
        </p>
      </div>

      <span className="shrink-0 text-xs text-[var(--tg-hint)]">
        {client.jobCount} {client.jobCount === 1 ? 'job' : 'jobs'}
      </span>
    </article>
  )
}
