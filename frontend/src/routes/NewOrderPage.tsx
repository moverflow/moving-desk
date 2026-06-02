import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import HomeSizePills from '@/components/shared/HomeSizePills'
import PricePreview from '@/components/shared/PricePreview'
import { useNewOrderForm } from '@/hooks/useNewOrderForm'
import { useCrews } from '@/hooks/useOrders'

export default function NewOrderPage(): JSX.Element {
  const { form, set, handlePhoneBlur, handleSubmit, isPending } = useNewOrderForm()
  const { data: crews = [] } = useCrews()

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <h1 className="text-xl font-semibold mb-5">New order</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={handlePhoneBlur} placeholder="(949) 555-0100" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" required value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
          </div>
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
        <PricePreview homeSize={form.homeSize} packing={form.packing} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save order'}
        </Button>
      </form>
    </div>
  )
}
