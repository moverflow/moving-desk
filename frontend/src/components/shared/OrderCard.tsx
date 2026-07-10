import type { JSX } from 'react'
import type { Order, OrderStatus } from '@/types'
import { formatDate } from '@/lib/utils'

const STATUS_BORDER: Record<OrderStatus, string> = {
  new: 'border-l-blue-400',
  confirmed: 'border-l-amber-400',
  in_progress: 'border-l-green-500',
  completed: 'border-l-gray-400',
  closed: 'border-l-gray-400',
  cancelled: 'border-l-gray-300',
}

export const HOME_SIZE_LABEL: Record<string, string> = {
  studio: 'Studio', '1br': '1 BR', '2br': '2 BR', '3br': '3 BR', house: 'House',
}

interface OrderCardProps {
  order: Order
  onClick: () => void
}

export default function OrderCard({ order, onClick }: OrderCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-md border border-l-4 ${STATUS_BORDER[order.status]} p-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm text-gray-900 truncate">{order.clientName}</p>
        {order.isOnline && (
          <span className="shrink-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
            🌐 Online
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 truncate mt-0.5">
        {order.fromAddress} → {order.toAddress}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">{formatDate(new Date(order.moveDate))}</span>
        <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
          {HOME_SIZE_LABEL[order.homeSize] ?? order.homeSize}
        </span>
      </div>
      {order.crewName && (
        <p className="text-xs text-gray-400 mt-1 truncate">{order.crewName}</p>
      )}
    </button>
  )
}
