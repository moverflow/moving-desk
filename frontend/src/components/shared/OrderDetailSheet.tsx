import type { JSX } from 'react'
import { useState } from 'react'
import type { Crew, Order, OrderStatus } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { useUpdateOrderStatus } from '@/hooks/useOrders'
import { useCrews } from '@/hooks/useCrews'
import OrderFiles from '@/components/shared/OrderFiles'
import ContractSection from '@/components/shared/ContractSection'

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Radix Select.Item can't take an empty-string value, so "no crew assigned"
// needs its own sentinel — mapped back to null right before the PATCH call.
const UNASSIGNED = 'unassigned'

function StatusField({ status, onChange }: { status: OrderStatus; onChange: (v: OrderStatus) => void }): JSX.Element {
  return (
    <div className="mt-6 space-y-2">
      <Label htmlFor="orderStatus">Status</Label>
      <Select value={status} onValueChange={(v) => onChange(v as OrderStatus)}>
        <SelectTrigger id="orderStatus">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface CrewFieldProps {
  crewId: string
  onChange: (v: string) => void
  crews: Crew[]
}

// The write path this task adds — orders booked through the public booking
// page start with no crew and had no way to assign one afterward. Wired to
// the same PATCH /orders/:id endpoint the Status field already uses.
function CrewField({ crewId, onChange, crews }: CrewFieldProps): JSX.Element {
  return (
    <div className="mt-4 space-y-2">
      <Label htmlFor="orderCrew">Crew</Label>
      <Select value={crewId} onValueChange={onChange}>
        <SelectTrigger id="orderCrew">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {crews.map((crew) => (
            <SelectItem key={crew.id} value={crew.id}>
              {crew.truckLabel ? `${crew.name} — ${crew.truckLabel}` : crew.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface OrderDetailSheetProps {
  order: Order
  onClose: () => void
}

export default function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps): JSX.Element {
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [crewId, setCrewId] = useState(order.crewId ?? UNASSIGNED)
  const { mutate, isPending } = useUpdateOrderStatus()
  const { data: crews = [] } = useCrews()

  // status is only sent when actually changed — see useUpdateOrderStatus.
  function handleSave(): void {
    mutate(
      {
        id: order.id,
        ...(status !== order.status ? { status } : {}),
        crewId: crewId === UNASSIGNED ? null : crewId,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{order.clientName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-gray-500">{order.fromAddress} → {order.toAddress}</p>
          <p className="text-gray-500">Move date: {formatDate(new Date(order.moveDate))}</p>
          <p className="text-gray-500">Total: ${order.totalPrice}</p>
        </div>
        <StatusField status={status} onChange={setStatus} />
        <CrewField crewId={crewId} onChange={setCrewId} crews={crews} />
        <Button className="mt-6 w-full" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <ContractSection order={order} />
        <OrderFiles orderId={order.id} />
      </SheetContent>
    </Sheet>
  )
}
