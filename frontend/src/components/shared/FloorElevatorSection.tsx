import type { JSX } from 'react'
import type { NewOrderFormState } from '@/hooks/useNewOrderForm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface FloorElevatorSectionProps {
  form: Pick<NewOrderFormState, 'fromFloor' | 'toFloor' | 'fromElevator' | 'toElevator' | 'packing'>
  set: <K extends keyof NewOrderFormState>(k: K, v: NewOrderFormState[K]) => void
}

export default function FloorElevatorSection({ form, set }: FloorElevatorSectionProps): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fromFloor">From floor</Label>
          <Input id="fromFloor" type="number" min={1} value={form.fromFloor} onChange={(e) => set('fromFloor', parseInt(e.target.value, 10) || 1)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toFloor">To floor</Label>
          <Input id="toFloor" type="number" min={1} value={form.toFloor} onChange={(e) => set('toFloor', parseInt(e.target.value, 10) || 1)} />
        </div>
      </div>
      <div className="flex gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch id="fromElevator" checked={form.fromElevator} onCheckedChange={(v) => set('fromElevator', v)} />
          <Label htmlFor="fromElevator">From elevator</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="toElevator" checked={form.toElevator} onCheckedChange={(v) => set('toElevator', v)} />
          <Label htmlFor="toElevator">To elevator</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="packing" checked={form.packing} onCheckedChange={(v) => set('packing', v)} />
          <Label htmlFor="packing">Packing</Label>
        </div>
      </div>
    </>
  )
}
