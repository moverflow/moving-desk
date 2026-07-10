import type { JSX } from 'react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { HomeSize, PublicBookingTenant, BookingFormData, BookingResult } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import HomeSizePills from '@/components/shared/HomeSizePills'
import BookingCalendar from './BookingCalendar'
import { useCreateBooking } from '@/hooks/useBooking'
import { ApiError } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const HOME_SIZE_LABEL: Record<HomeSize, string> = {
  studio: 'Studio', '1br': '1 BR', '2br': '2 BR', '3br': '3 BR', house: 'House',
}

interface BookingFormProps {
  slug: string
  tenant: PublicBookingTenant
  onSuccess: (result: BookingResult, data: BookingFormData) => void
}

interface FormState {
  clientPhone: string
  clientName: string
  clientEmail: string
  fromAddress: string
  toAddress: string
  homeSize: HomeSize
  moveDate: string | null
  fromElevator: boolean
  toElevator: boolean
  packing: boolean
  fromFloor: number
  toFloor: number
  notes: string
}

const INITIAL: FormState = {
  clientPhone: '', clientName: '', clientEmail: '',
  fromAddress: '', toAddress: '', homeSize: '2br', moveDate: null,
  fromElevator: false, toElevator: false, packing: false,
  fromFloor: 1, toFloor: 1, notes: '',
}

export default function BookingForm({ slug, tenant, onSuccess }: BookingFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useCreateBooking(slug)

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const basePrice = tenant.baseRates[form.homeSize] ?? 0
  const estimatedPrice = basePrice + (form.packing ? tenant.packingFee : 0)

  const canSubmit =
    form.clientPhone.trim().length > 0 &&
    form.clientName.trim().length >= 2 &&
    form.fromAddress.trim().length > 0 &&
    form.toAddress.trim().length > 0 &&
    form.moveDate !== null

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!canSubmit || form.moveDate === null) return

    const payload: BookingFormData = {
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      ...(form.clientEmail.trim() ? { clientEmail: form.clientEmail.trim() } : {}),
      fromAddress: form.fromAddress.trim(),
      toAddress: form.toAddress.trim(),
      moveDate: form.moveDate,
      homeSize: form.homeSize,
      fromFloor: form.fromFloor,
      toFloor: form.toFloor,
      fromElevator: form.fromElevator,
      toElevator: form.toElevator,
      packing: form.packing,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    }

    try {
      const result = await mutateAsync(payload)
      onSuccess(result, payload)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message)
        if (err.message.toLowerCase().includes('no longer available')) {
          set('moveDate', null)
          void queryClient.invalidateQueries({ queryKey: ['booking-availability', slug] })
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Book your move</h2>

      <div className="space-y-1.5">
        <Label htmlFor="clientPhone">Phone *</Label>
        <Input id="clientPhone" type="tel" inputMode="tel" value={form.clientPhone}
          onChange={(e) => set('clientPhone', e.target.value)} placeholder="(949) 555-0100" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clientName">Name *</Label>
        <Input id="clientName" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clientEmail">Email (optional)</Label>
        <Input id="clientEmail" type="email" value={form.clientEmail}
          onChange={(e) => set('clientEmail', e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fromAddress">From address *</Label>
        <Input id="fromAddress" value={form.fromAddress} onChange={(e) => set('fromAddress', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="toAddress">To address *</Label>
        <Input id="toAddress" value={form.toAddress} onChange={(e) => set('toAddress', e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Home size</Label>
        <HomeSizePills value={form.homeSize} onChange={(s) => set('homeSize', s)} />
      </div>

      <div className="space-y-1.5">
        <Label>Select move date *</Label>
        <BookingCalendar slug={slug} selectedDate={form.moveDate} onSelect={(d) => set('moveDate', d)} />
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
          <Label htmlFor="packing">Packing service</Label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fromFloor">From floor</Label>
          <Input id="fromFloor" type="number" min={1} value={form.fromFloor}
            onChange={(e) => set('fromFloor', parseInt(e.target.value, 10) || 1)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toFloor">To floor</Label>
          <Input id="toFloor" type="number" min={1} value={form.toFloor}
            onChange={(e) => set('toFloor', parseInt(e.target.value, 10) || 1)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>

      <div className="rounded-md border px-4 py-3 flex items-center justify-between bg-gray-50">
        <div>
          <p className="text-sm text-gray-600">Estimated price</p>
          <p className="text-xs text-gray-400">Base rate for {HOME_SIZE_LABEL[form.homeSize]}</p>
        </div>
        <span className="text-xl font-semibold" style={{ color: '#1d9e75' }}>
          {formatCurrency(estimatedPrice)}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit || isPending}>
        {isPending ? 'Booking…' : 'Book my move →'}
      </Button>
    </form>
  )
}
