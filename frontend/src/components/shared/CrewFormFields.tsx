import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface CrewFormFieldsProps {
  idPrefix: string
  name: string
  truckLabel: string
  phone: string
  active?: boolean
  onNameChange: (value: string) => void
  onTruckLabelChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onActiveChange?: (value: boolean) => void
}

export default function CrewFormFields({
  idPrefix,
  name,
  truckLabel,
  phone,
  active,
  onNameChange,
  onTruckLabelChange,
  onPhoneChange,
  onActiveChange,
}: CrewFormFieldsProps): JSX.Element {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Crew name</Label>
        <Input id={`${idPrefix}-name`} required value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-truck`}>Truck label</Label>
        <Input id={`${idPrefix}-truck`} placeholder="Truck #3" value={truckLabel} onChange={(e) => onTruckLabelChange(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input id={`${idPrefix}-phone`} type="tel" value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
      </div>
      {onActiveChange && (
        <div className="flex items-center gap-2">
          <Switch id={`${idPrefix}-active`} checked={active ?? true} onCheckedChange={onActiveChange} />
          <Label htmlFor={`${idPrefix}-active`}>Active</Label>
        </div>
      )}
    </>
  )
}
