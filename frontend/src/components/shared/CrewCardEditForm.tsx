import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import CrewFormFields from './CrewFormFields'
import { useUpdateCrew } from '@/hooks/useCrews'
import { ApiError } from '@/lib/api'
import type { Crew } from '@/types'

interface CrewCardEditFormProps {
  crew: Crew
  onDone: () => void
}

export default function CrewCardEditForm({ crew, onDone }: CrewCardEditFormProps): JSX.Element {
  const [name, setName] = useState(crew.name)
  const [truckLabel, setTruckLabel] = useState(crew.truckLabel)
  const [phone, setPhone] = useState(crew.phone ?? '')
  const [active, setActive] = useState(crew.active)
  const [error, setError] = useState<string | null>(null)
  const { mutate: updateCrew, isPending } = useUpdateCrew()

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    updateCrew(
      { id: crew.id, name, truckLabel: truckLabel || undefined, phone: phone || undefined, active },
      {
        onSuccess: () => onDone(),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save crew'),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-3">
      <CrewFormFields
        idPrefix={`crew-${crew.id}`}
        name={name}
        truckLabel={truckLabel}
        phone={phone}
        active={active}
        onNameChange={setName}
        onTruckLabelChange={setTruckLabel}
        onPhoneChange={setPhone}
        onActiveChange={setActive}
      />
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}
