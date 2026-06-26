import type { JSX } from 'react'
import type { NewOrderFormState } from '@/hooks/useNewOrderForm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddressFieldsProps {
  form: Pick<NewOrderFormState, 'phone' | 'clientName' | 'clientEmail' | 'fromAddress' | 'toAddress'>
  set: <K extends keyof NewOrderFormState>(k: K, v: NewOrderFormState[K]) => void
  onPhoneBlur: () => void
}

export default function AddressFields({ form, set, onPhoneBlur }: AddressFieldsProps): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={onPhoneBlur} placeholder="(949) 555-0100" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientName">Client name</Label>
          <Input id="clientName" required value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clientEmail">Client email</Label>
        <Input id="clientEmail" type="email" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} placeholder="client@email.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fromAddress">From address</Label>
          <Input id="fromAddress" required value={form.fromAddress} onChange={(e) => set('fromAddress', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toAddress">To address</Label>
          <Input id="toAddress" required value={form.toAddress} onChange={(e) => set('toAddress', e.target.value)} />
        </div>
      </div>
    </>
  )
}
