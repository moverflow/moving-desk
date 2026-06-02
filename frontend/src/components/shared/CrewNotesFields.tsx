import type { JSX } from 'react'
import type { Crew } from '@/types'
import type { NewOrderFormState } from '@/hooks/useNewOrderForm'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CrewNotesFieldsProps {
  form: Pick<NewOrderFormState, 'crewId' | 'notes'>
  set: <K extends keyof NewOrderFormState>(k: K, v: NewOrderFormState[K]) => void
  crews: Crew[]
}

export default function CrewNotesFields({ form, set, crews }: CrewNotesFieldsProps): JSX.Element {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="crew">Assign crew</Label>
        <Select value={form.crewId} onValueChange={(v) => set('crewId', v)}>
          <SelectTrigger id="crew"><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            {crews.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} — {c.truckLabel}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>
    </>
  )
}
