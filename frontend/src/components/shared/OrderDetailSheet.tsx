import type { JSX } from 'react'
import { useState } from 'react'
import type { Order, OrderStatus } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { useUpdateOrderStatus } from '@/hooks/useOrders'
import OrderFiles from '@/components/shared/OrderFiles'

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface OrderDetailSheetProps {
  order: Order
  onClose: () => void
}

export default function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps): JSX.Element {
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const { mutate, isPending } = useUpdateOrderStatus()

  function handleSave(): void {
    mutate({ id: order.id, status }, { onSuccess: onClose })
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
          {order.crewName && <p className="text-gray-500">Crew: {order.crewName}</p>}
          <p className="text-gray-500">Total: ${order.totalPrice}</p>
        </div>
        <div className="mt-6 space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="mt-6 w-full" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <OrderFiles orderId={order.id} />
      </SheetContent>
    </Sheet>
  )
}
