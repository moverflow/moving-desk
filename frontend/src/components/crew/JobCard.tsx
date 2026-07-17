import type { JSX } from 'react'
import type { CrewJob, HomeSize } from '@/types'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/utils'
import { useCrewJobFiles } from '@/hooks/useCrewJobs'

const HOME_SIZE_LABELS: Record<HomeSize, string> = {
  studio: 'Studio',
  '1br': '1 BR',
  '2br': '2 BR',
  '3br': '3 BR',
  house: 'House',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
}

function floorLine(floor: number, elevator: boolean): string {
  return `Floor ${floor} — ${elevator ? 'Elevator available' : 'No elevator'}`
}

interface JobCardProps {
  job: CrewJob
  onUpdateStatus: (status: 'in_progress' | 'completed') => void
  isUpdating: boolean
}

export default function JobCard({ job, onUpdateStatus, isUpdating }: JobCardProps): JSX.Element {
  const { data: files = [] } = useCrewJobFiles(job.id)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <span>🏠 {HOME_SIZE_LABELS[job.homeSize]}</span>
        {job.packing && <span className="text-gray-400">•</span>}
        {job.packing && <span>Packing included</span>}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">📍 From</p>
        <p className="text-sm text-gray-900">{job.fromAddress}</p>
        <p className="text-sm text-gray-500">{floorLine(job.fromFloor, job.fromElevator)}</p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">📍 To</p>
        <p className="text-sm text-gray-900">{job.toAddress}</p>
        <p className="text-sm text-gray-500">{floorLine(job.toFloor, job.toElevator)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-900">👤 {job.clientName || 'Client'}</p>
          {job.clientPhone && (
            <p className="text-sm text-gray-500">📞 {formatPhone(job.clientPhone)}</p>
          )}
        </div>
        {job.clientPhone && (
          <a
            href={`tel:${job.clientPhone}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Call
          </a>
        )}
      </div>

      {job.notes && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          📝 {job.notes}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500">📎 Files ({files.length})</p>
          <ul className="mt-1 space-y-1">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-gray-700">{f.name}</span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 shrink-0 font-medium text-[#1d9e75]"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-500">
          Status: <span className="font-medium text-gray-900">{STATUS_LABELS[job.status] ?? job.status}</span>
        </p>

        {job.status === 'confirmed' && (
          <Button
            type="button"
            className="mt-3 h-12 w-full text-base"
            disabled={isUpdating}
            onClick={() => onUpdateStatus('in_progress')}
          >
            ▶ Start move
          </Button>
        )}

        {job.status === 'in_progress' && (
          <Button
            type="button"
            className="mt-3 h-12 w-full text-base"
            disabled={isUpdating}
            onClick={() => onUpdateStatus('completed')}
          >
            ✓ Complete move
          </Button>
        )}

        {job.status === 'completed' && (
          <div className="mt-3 rounded-md bg-green-50 py-2 text-center text-sm font-medium text-green-700">
            ✅ Completed
          </div>
        )}
      </div>
    </div>
  )
}
