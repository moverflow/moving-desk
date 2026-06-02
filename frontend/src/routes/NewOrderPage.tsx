import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HomeSizePills from '@/components/shared/HomeSizePills'
import PricePreview from '@/components/shared/PricePreview'
import AddressFields from '@/components/shared/AddressFields'
import FloorElevatorSection from '@/components/shared/FloorElevatorSection'
import CrewNotesFields from '@/components/shared/CrewNotesFields'
import { useNewOrderForm } from '@/hooks/useNewOrderForm'
import { useCrews } from '@/hooks/useOrders'

export default function NewOrderPage(): JSX.Element {
  const { form, set, handlePhoneBlur, handleSubmit, isPending } = useNewOrderForm()
  const { data: crews = [] } = useCrews()

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <h1 className="text-xl font-semibold mb-5">New order</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AddressFields form={form} set={set} onPhoneBlur={handlePhoneBlur} />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="moveDate">Move date</Label>
            <Input id="moveDate" type="date" required value={form.moveDate} onChange={(e) => set('moveDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Home size</Label>
            <HomeSizePills value={form.homeSize} onChange={(s) => set('homeSize', s)} />
          </div>
        </div>
        <FloorElevatorSection form={form} set={set} />
        <CrewNotesFields form={form} set={set} crews={crews} />
        <PricePreview homeSize={form.homeSize} packing={form.packing} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save order'}
        </Button>
      </form>
    </div>
  )
}
