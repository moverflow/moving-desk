import type { JSX } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import InvoiceListItem from '@/components/shared/InvoiceListItem'
import InvoiceDetail from '@/components/shared/InvoiceDetail'
import { useInvoices, useGenerateInvoice } from '@/hooks/useInvoices'

export default function InvoicesPage(): JSX.Element {
  const { data: invoices = [], isLoading } = useInvoices()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { mutate: generate, isPending: isGenerating } = useGenerateInvoice()
  const selected = invoices.find((i) => i.id === selectedId) ?? invoices[0] ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-44px)]">
      <aside className="w-72 border-r flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h1 className="text-sm font-semibold">Invoices</h1>
          <Button size="sm" variant="outline" disabled={isGenerating} onClick={() => generate('order-1')}>
            {isGenerating ? '...' : '+ Generate'}
          </Button>
        </div>
        <div className="divide-y overflow-y-auto flex-1">
          {invoices.map((inv) => (
            <InvoiceListItem key={inv.id} invoice={inv} selected={inv.id === selected?.id} onClick={() => setSelectedId(inv.id)} />
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {selected !== null
          ? <InvoiceDetail invoice={selected} />
          : <div className="flex items-center justify-center h-full text-sm text-gray-400">Select an invoice</div>
        }
      </main>
    </div>
  )
}
