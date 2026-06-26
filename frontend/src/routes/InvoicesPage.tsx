import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import InvoiceListItem from '@/components/shared/InvoiceListItem'
import InvoiceDetail from '@/components/shared/InvoiceDetail'
import PageContainer from '@/components/shared/PageContainer'
import { useInvoices, useGenerateInvoice } from '@/hooks/useInvoices'
import { useOrders } from '@/hooks/useOrders'
import { ApiError } from '@/lib/api'

export default function InvoicesPage(): JSX.Element {
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices()
  const { data: orders = [], isLoading: isLoadingOrders } = useOrders()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { mutate: generate, isPending: isGenerating } = useGenerateInvoice()
  const selected = invoices.find((i) => i.id === selectedId) ?? invoices[0] ?? null

  const invoicedOrderIds = useMemo(() => new Set(invoices.map((i) => i.orderId)), [invoices])

  const eligibleOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (o.status === 'completed' || o.status === 'closed') &&
          !invoicedOrderIds.has(o.id),
      ),
    [orders, invoicedOrderIds],
  )

  useEffect(() => {
    if (eligibleOrders.length === 0) {
      setSelectedOrderId('')
      return
    }
    if (!eligibleOrders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(eligibleOrders[0].id)
    }
  }, [eligibleOrders, selectedOrderId])

  const isLoading = isLoadingInvoices || isLoadingOrders

  function handleGenerate(): void {
    if (!selectedOrderId) return
    setError(null)
    generate(selectedOrderId, {
      onSuccess: (invoice) => setSelectedId(invoice.id),
      onError: (err) => {
        if (err instanceof ApiError) setError(err.message)
        else setError('Failed to generate invoice')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <aside className="w-72 border-r flex flex-col">
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Invoices</h1>
            <Button
              size="sm"
              variant="outline"
              disabled={isGenerating || eligibleOrders.length === 0}
              onClick={handleGenerate}
            >
              {isGenerating ? '...' : '+ Generate'}
            </Button>
          </div>
          {eligibleOrders.length > 1 && (
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select completed order" />
              </SelectTrigger>
              <SelectContent>
                {eligibleOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.clientName || order.fromAddress} — {order.moveDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {eligibleOrders.length === 0 && (
            <p className="text-xs text-muted-foreground">Complete an order to generate an invoice.</p>
          )}
          {error !== null && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="divide-y overflow-y-auto flex-1">
          {invoices.map((inv) => (
            <InvoiceListItem key={inv.id} invoice={inv} selected={inv.id === selected?.id} onClick={() => setSelectedId(inv.id)} />
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {selected !== null
          ? (
            <PageContainer>
              <InvoiceDetail invoice={selected} />
            </PageContainer>
          )
          : <div className="flex items-center justify-center h-full text-sm text-gray-400">Select an invoice</div>
        }
      </main>
    </div>
  )
}
