import type { JSX } from 'react'
import { useState } from 'react'
import type { Lead, LeadStatus } from '@/types'
import { useLeads, useUpdateLead, useMarkLeadLost, useConvertLead } from '@/hooks/useLeads'
import LeadCard from './LeadCard'
import AddLeadPanel from './AddLeadPanel'
import ConvertModal from './ConvertModal'

const COLUMNS: { title: string; status: LeadStatus }[] = [
  { title: 'New', status: 'new' },
  { title: 'Contacted', status: 'contacted' },
  { title: 'Quoted', status: 'quoted' },
  { title: 'Booked', status: 'booked' },
]

interface LeadsPipelineProps {
  onConverted: () => void
}

export default function LeadsPipeline({ onConverted }: LeadsPipelineProps): JSX.Element {
  const { data: leads = [], isLoading } = useLeads()
  const { mutate: updateLead } = useUpdateLead()
  const { mutate: markLost } = useMarkLeadLost()
  const { mutate: convertLead, isPending: isConverting } = useConvertLead()

  const [showLost, setShowLost] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const columns = showLost ? [...COLUMNS, { title: 'Lost', status: 'lost' as LeadStatus }] : COLUMNS

  function advance(lead: Lead, status: LeadStatus): void {
    setBusyId(lead.id)
    updateLead({ id: lead.id, status }, { onSettled: () => setBusyId(null) })
  }

  function lose(lead: Lead): void {
    setBusyId(lead.id)
    markLost(lead.id, { onSettled: () => setBusyId(null) })
  }

  function confirmConvert(): void {
    if (!convertTarget) return
    convertLead(convertTarget.id, {
      onSuccess: () => {
        setConvertTarget(null)
        onConverted()
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} />
          Show lost leads
        </label>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          + New lead
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto">
        {columns.map(({ title, status }) => {
          const columnLeads = leads.filter((l) => l.status === status)
          return (
            <div key={status} className="min-w-[240px] flex-1">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                {title}
                <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-500">{columnLeads.length}</span>
              </div>
              <div className="space-y-2">
                {columnLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isBusy={busyId === lead.id}
                    onAdvance={(next) => advance(lead, next)}
                    onConvert={() => setConvertTarget(lead)}
                    onLost={() => lose(lead)}
                  />
                ))}
                {columnLeads.length === 0 && <p className="text-xs text-gray-400">No leads</p>}
              </div>
            </div>
          )
        })}
      </div>

      {addOpen && <AddLeadPanel onClose={() => setAddOpen(false)} />}
      {convertTarget && (
        <ConvertModal
          lead={convertTarget}
          isPending={isConverting}
          onConfirm={confirmConvert}
          onCancel={() => setConvertTarget(null)}
        />
      )}
    </div>
  )
}
