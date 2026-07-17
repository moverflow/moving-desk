import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import type { HomeSize } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCreateLead } from '@/hooks/useLeads'
import { ApiError } from '@/lib/api'

const SIZES: { value: HomeSize; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: '1br', label: '1 BR' },
  { value: '2br', label: '2 BR' },
  { value: '3br', label: '3 BR' },
  { value: 'house', label: 'House' },
]

interface AddLeadPanelProps {
  onClose: () => void
}

export default function AddLeadPanel({ onClose }: AddLeadPanelProps): JSX.Element {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [homeSize, setHomeSize] = useState<HomeSize | undefined>(undefined)
  const [source, setSource] = useState<'manual' | 'phone'>('manual')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { mutate: createLead, isPending } = useCreateLead()

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    createLead(
      {
        name,
        phone: phone || undefined,
        email: email || undefined,
        fromAddress: fromAddress || undefined,
        toAddress: toAddress || undefined,
        moveDate: moveDate || undefined,
        homeSize,
        notes: notes || undefined,
        source,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
      },
    )
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New lead</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" required minLength={1} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Phone</Label>
            <Input id="lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-from">From address</Label>
            <Input id="lead-from" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-to">To address</Label>
            <Input id="lead-to" value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-date">Move date</Label>
            <Input id="lead-date" type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Home size</Label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHomeSize((cur) => (cur === value ? undefined : value))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors',
                    homeSize === value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <div className="flex gap-2">
              {(['manual', 'phone'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border capitalize transition-colors',
                    source === s
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea id="lead-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save lead'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
