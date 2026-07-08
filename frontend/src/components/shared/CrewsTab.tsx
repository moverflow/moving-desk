import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import CrewCard from './CrewCard'
import CrewFormFields from './CrewFormFields'
import { useCrews, useCreateCrew } from '@/hooks/useCrews'
import { ApiError } from '@/lib/api'

export default function CrewsTab(): JSX.Element {
  const { data: crews = [] } = useCrews(true)
  const { mutate: createCrew, isPending } = useCreateCrew()
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [truckLabel, setTruckLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  function resetForm(): void {
    setName('')
    setTruckLabel('')
    setPhone('')
    setError(null)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    createCrew(
      { name, truckLabel: truckLabel || undefined, phone: phone || undefined },
      {
        onSuccess: () => {
          resetForm()
          setIsAdding(false)
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add crew'),
      },
    )
  }

  return (
    <div className="mt-4 space-y-5">
      <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding((v) => !v)}>
        {isAdding ? 'Cancel' : '+ Add crew'}
      </Button>
      {isAdding && (
        <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-3">
          <CrewFormFields
            idPrefix="new-crew"
            name={name}
            truckLabel={truckLabel}
            phone={phone}
            onNameChange={setName}
            onTruckLabelChange={setTruckLabel}
            onPhoneChange={setPhone}
          />
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { resetForm(); setIsAdding(false) }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {crews.map((crew) => <CrewCard key={crew.id} crew={crew} />)}
      </div>
    </div>
  )
}
