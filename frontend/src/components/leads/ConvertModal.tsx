import type { JSX } from 'react'
import type { Lead } from '@/types'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

const HOME_SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1br': '1BR',
  '2br': '2BR',
  '3br': '3BR',
  house: 'House',
}

interface ConvertModalProps {
  lead: Lead
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export default function ConvertModal({ lead, onConfirm, onCancel, isPending }: ConvertModalProps): JSX.Element {
  const details = [
    lead.fromAddress && lead.toAddress ? `${lead.fromAddress} → ${lead.toAddress}` : null,
    [
      lead.moveDate ? formatDate(new Date(`${lead.moveDate}T00:00:00Z`)) : null,
      lead.homeSize ? (HOME_SIZE_LABELS[lead.homeSize] ?? lead.homeSize) : null,
    ]
      .filter(Boolean)
      .join(', ') || null,
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-gray-900">Convert this lead to an order?</h2>
        <p className="mt-2 text-sm text-gray-500">Move details from lead:</p>
        <ul className="mt-2 space-y-1 text-sm text-gray-900">
          <li>• {lead.name}</li>
          {details.map((d) => (
            <li key={d as string}>• {d}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          These will be pre-filled in the new order. Any missing details can be added after.
        </p>
        <div className="mt-5 flex gap-2">
          <Button type="button" className="flex-1" disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Converting...' : 'Convert'}
          </Button>
          <Button type="button" variant="outline" className="flex-1" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
