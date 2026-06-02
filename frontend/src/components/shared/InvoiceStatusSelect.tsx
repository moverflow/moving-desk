import type { JSX } from 'react'
import { useState } from 'react'
import type { InvoiceStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateInvoiceStatus } from '@/hooks/useInvoices'

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
]

interface InvoiceStatusSelectProps {
  id: string
  currentStatus: InvoiceStatus
}

export default function InvoiceStatusSelect({ id, currentStatus }: InvoiceStatusSelectProps): JSX.Element {
  const [status, setStatus] = useState<InvoiceStatus>(currentStatus)
  const { mutate: updateStatus, isPending } = useUpdateInvoiceStatus()

  return (
    <div className="flex items-end gap-3 pt-2 border-t">
      <div className="flex-1 space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => updateStatus({ id, status })} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
