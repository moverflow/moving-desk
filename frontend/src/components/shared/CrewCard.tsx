import type { JSX } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import CrewCardEditForm from './CrewCardEditForm'
import { formatPhone } from '@/lib/utils'
import type { Crew } from '@/types'

interface CrewCardProps {
  crew: Crew
}

export default function CrewCard({ crew }: CrewCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return <CrewCardEditForm crew={crew} onDone={() => setIsEditing(false)} />
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">🚛 {crew.name}</p>
        {crew.truckLabel && <p className="text-xs text-gray-500">{crew.truckLabel}</p>}
        {crew.phone && <p className="text-xs text-gray-500">{formatPhone(crew.phone)}</p>}
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <span className={crew.active ? 'text-green-500' : 'text-gray-400'}>●</span>
          {crew.active ? 'Active' : 'Inactive'}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>
    </div>
  )
}
