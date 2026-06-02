import type { JSX } from 'react'
import type { Order } from '@/types'
import { Badge } from '@/components/ui/badge'
import OrderCard from '@/components/shared/OrderCard'

interface KanbanColumnProps {
  title: string
  orders: Order[]
  onCardClick: (order: Order) => void
}

export default function KanbanColumn({ title, orders, onCardClick }: KanbanColumnProps): JSX.Element {
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <Badge variant="secondary" className="text-xs px-1.5 py-0">{orders.length}</Badge>
      </div>
      <div className="space-y-2">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onClick={() => onCardClick(order)} />
        ))}
        {orders.length === 0 && (
          <div className="text-xs text-gray-400 py-6 text-center border border-dashed rounded-md">
            No orders
          </div>
        )}
      </div>
    </div>
  )
}
