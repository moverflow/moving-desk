import type { JSX } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Order, OrderStatus } from '@/types'
import { useOrders } from '@/hooks/useOrders'
import { useLeads } from '@/hooks/useLeads'
import KanbanColumn from '@/components/shared/KanbanColumn'
import OrderDetailSheet from '@/components/shared/OrderDetailSheet'
import LeadsPipeline from '@/components/leads/LeadsPipeline'

const COLUMNS: { title: string; status: OrderStatus }[] = [
  { title: 'New', status: 'new' },
  { title: 'Confirmed', status: 'confirmed' },
  { title: 'In progress', status: 'in_progress' },
  { title: 'Done', status: 'completed' },
]

type Tab = 'kanban' | 'leads'

function KanbanBoard(): JSX.Element {
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
    <div className="overflow-x-auto">
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
      {selected !== null && <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default function OrdersPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'leads' ? 'leads' : 'kanban')
  const [toast, setToast] = useState<string | null>(null)
  const { data: leads = [] } = useLeads()
  const newLeadsCount = leads.filter((l) => l.status === 'new').length

  function handleConverted(): void {
    setTab('kanban')
    setToast('Lead converted! Order created.')
    setTimeout(() => setToast(null), 3000)
  }

  const tabClass = (active: boolean): string =>
    `px-3 py-2 text-sm font-medium ${active ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button type="button" className={tabClass(tab === 'kanban')} onClick={() => setTab('kanban')}>
          📋 Orders
        </button>
        <button type="button" className={tabClass(tab === 'leads')} onClick={() => setTab('leads')}>
          🎯 Leads
          {newLeadsCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#1d9e75] px-1.5 py-0.5 text-xs text-white">{newLeadsCount}</span>
          )}
        </button>
      </div>

      {toast && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{toast}</div>
      )}

      {tab === 'kanban' ? <KanbanBoard /> : <LeadsPipeline onConverted={handleConverted} />}
    </div>
  )
}
