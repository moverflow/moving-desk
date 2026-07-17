import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import type { Lead, LeadSource, LeadStatus } from '@/types'
import { formatDate, formatPhone } from '@/lib/utils'

const SOURCE_BADGES: Record<LeadSource, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'bg-gray-100 text-gray-600' },
  booking_page: { label: 'Online', className: 'bg-blue-100 text-blue-700' },
  zapier: { label: 'Zapier', className: 'bg-purple-100 text-purple-700' },
  phone: { label: 'Phone', className: 'bg-green-100 text-green-700' },
}

const HOME_SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1br': '1BR',
  '2br': '2BR',
  '3br': '3BR',
  house: 'House',
}

// Primary "advance to next stage" action per status.
const NEXT_STAGE: Partial<Record<LeadStatus, { label: string; to: LeadStatus }>> = {
  new: { label: 'Mark as Contacted', to: 'contacted' },
  contacted: { label: 'Send Quote', to: 'quoted' },
}

interface LeadCardProps {
  lead: Lead
  onAdvance: (status: LeadStatus) => void
  onConvert: () => void
  onLost: () => void
  isBusy: boolean
}

export default function LeadCard({ lead, onAdvance, onConvert, onLost, isBusy }: LeadCardProps): JSX.Element {
  const badge = SOURCE_BADGES[lead.source]
  const next = NEXT_STAGE[lead.status]
  const metaBits = [
    lead.moveDate ? formatDate(new Date(`${lead.moveDate}T00:00:00Z`)) : null,
    lead.homeSize ? (HOME_SIZE_LABELS[lead.homeSize] ?? lead.homeSize) : null,
  ].filter(Boolean)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{lead.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      {lead.phone && <p className="mt-0.5 text-xs text-gray-500">{formatPhone(lead.phone)}</p>}
      {metaBits.length > 0 && <p className="mt-0.5 text-xs text-gray-500">{metaBits.join(' • ')}</p>}
      {(lead.fromAddress || lead.toAddress) && (
        <p className="mt-0.5 text-xs text-gray-500 truncate">
          {lead.fromAddress ?? '—'} → {lead.toAddress ?? '—'}
        </p>
      )}

      {lead.status === 'booked' ? (
        <div className="mt-3 text-xs text-gray-500">
          {lead.convertedOrderId ? (
            <Link to="/orders" className="font-medium text-[#1d9e75]">
              View order →
            </Link>
          ) : (
            'Converted'
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {next && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAdvance(next.to)}
              className="w-full rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {next.label} ▶
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onConvert}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {lead.status === 'quoted' ? 'Book it' : 'Convert to order'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onLost}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              Lost
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
