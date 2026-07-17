import type { JSX } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CrewJob } from '@/types'
import JobCard from '@/components/crew/JobCard'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/hooks/useAuth'
import { useCrewJobs, useUpdateCrewJobStatus } from '@/hooks/useCrewJobs'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatDate } from '@/lib/utils'

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().split('T')[0]
}

function sectionLabel(dateStr: string): string {
  return formatDate(new Date(`${dateStr}T00:00:00Z`))
}

interface JobsSectionProps {
  title: string
  dateLabel: string
  jobs: CrewJob[]
  updatingId: string | null
  onUpdate: (id: string, status: 'in_progress' | 'completed') => void
}

function JobsSection({ title, dateLabel, jobs, updatingId, onUpdate }: JobsSectionProps): JSX.Element | null {
  if (jobs.length === 0) return null
  return (
    <section className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title} — {dateLabel}
      </h2>
      <div className="mt-1 border-t border-gray-200" />
      <div className="mt-3 space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isUpdating={updatingId === job.id}
            onUpdateStatus={(status) => onUpdate(job.id, status)}
          />
        ))}
      </div>
    </section>
  )
}

export default function CrewHomePage(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isOnline = useOnlineStatus()
  const { data: jobs = [], isLoading } = useCrewJobs()
  const { mutate: updateStatus } = useUpdateCrewJobStatus()
  const { mutate: logout } = useLogout()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = isoDate(0)
  const tomorrow = isoDate(1)
  const todayJobs = jobs.filter((j) => j.moveDate === today)
  const tomorrowJobs = jobs.filter((j) => j.moveDate === tomorrow)

  function handleUpdate(id: string, status: 'in_progress' | 'completed'): void {
    setError(null)
    if (!isOnline) {
      setError("You're offline — reconnect to update job status.")
      return
    }
    setUpdatingId(id)
    updateStatus(
      { id, status },
      {
        onError: () => setError('Could not update job status. Please try again.'),
        onSettled: () => setUpdatingId(null),
      },
    )
  }

  function handleLogout(): void {
    logout(undefined, { onSettled: () => navigate('/crew/login', { replace: true }) })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isOnline && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          ⚠️ You&apos;re offline — showing cached jobs
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong> Crew
          </span>
          <button type="button" onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">
            Log out
          </button>
        </div>
        {user && (
          <p className="mt-0.5 text-sm text-gray-500">
            {user.name}
            {user.crewName ? ` — ${user.crewName}` : ''}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-[560px] px-4 pb-10">
        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <p className="text-lg">✅ No jobs scheduled</p>
            <p className="mt-2 text-sm">Check back later or contact your dispatcher.</p>
          </div>
        ) : (
          <>
            <JobsSection
              title="TODAY"
              dateLabel={sectionLabel(today)}
              jobs={todayJobs}
              updatingId={updatingId}
              onUpdate={handleUpdate}
            />
            <JobsSection
              title="TOMORROW"
              dateLabel={sectionLabel(tomorrow)}
              jobs={tomorrowJobs}
              updatingId={updatingId}
              onUpdate={handleUpdate}
            />
          </>
        )}
      </main>
    </div>
  )
}
