import type { JSX } from 'react'
import { useState } from 'react'
import type { Order, OrderStatus } from '@/types'
import { useOrders } from '@/hooks/useOrders'
import KanbanColumn from '@/components/shared/KanbanColumn'
import OrderDetailSheet from '@/components/shared/OrderDetailSheet'

const COLUMNS: { title: string; status: OrderStatus }[] = [
  { title: 'New', status: 'new' },
  { title: 'Confirmed', status: 'confirmed' },
  { title: 'In progress', status: 'in_progress' },
  { title: 'Done', status: 'completed' },
]

export default function OrdersPage(): JSX.Element {
  const { data: orders = [], isLoading } = useOrders()
  const [selected, setSelected] = useState<Order | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-4 min-w-[800px]">
        {COLUMNS.map(({ title, status }) => (
          <KanbanColumn
            key={status}
            title={title}
            orders={orders.filter((o) => o.status === status)}
            onCardClick={setSelected}
          />
        ))}
      </div>
      {selected !== null && (
        <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
