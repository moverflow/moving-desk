import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { Invoice, Order } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import InvoiceListItem from '@/components/shared/InvoiceListItem'
import InvoiceDetail from '@/components/shared/InvoiceDetail'
import PageContainer from '@/components/shared/PageContainer'
import { useInvoices, useGenerateInvoice } from '@/hooks/useInvoices'
import { useOrders } from '@/hooks/useOrders'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

interface InvoiceListPaneProps {
  invoices: Invoice[]
  selectedId?: string
  onSelect: (id: string) => void
  eligibleOrders: Order[]
  selectedOrderId: string
  onSelectedOrderIdChange: (id: string) => void
  isGenerating: boolean
  onGenerate: () => void
  error: string | null
  hiddenOnMobile: boolean
}

// On mobile, only one of this pane and InvoiceDetailPane is visible at a time
// (see mobileShowDetail in InvoicesPage) — sm: and up, both always show.
type GenerateControlsProps = Pick<
  InvoiceListPaneProps,
  'eligibleOrders' | 'selectedOrderId' | 'onSelectedOrderIdChange' | 'isGenerating' | 'onGenerate' | 'error'
>

function InvoiceGenerateControls(props: GenerateControlsProps): JSX.Element {
  const { eligibleOrders, selectedOrderId, onSelectedOrderIdChange, isGenerating, onGenerate, error } = props
  return (
    <div className="px-4 py-3 border-b space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Invoices</h1>
        <Button size="sm" variant="outline" disabled={isGenerating || eligibleOrders.length === 0} onClick={onGenerate}>
          {isGenerating ? '...' : '+ Generate'}
        </Button>
      </div>
      {eligibleOrders.length > 1 && (
        <Select value={selectedOrderId} onValueChange={onSelectedOrderIdChange}>
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
  )
}

function InvoiceListPane(props: InvoiceListPaneProps): JSX.Element {
  const { invoices, selectedId, onSelect, hiddenOnMobile, ...controls } = props
  return (
    <aside className={cn('w-full sm:w-72 h-full border-r flex-col', hiddenOnMobile ? 'hidden sm:flex' : 'flex')}>
      <InvoiceGenerateControls {...controls} />
      <div className="divide-y overflow-y-auto flex-1">
        {invoices.map((inv) => (
          <InvoiceListItem key={inv.id} invoice={inv} selected={inv.id === selectedId} onClick={() => onSelect(inv.id)} />
        ))}
      </div>
    </aside>
  )
}

interface InvoiceDetailPaneProps {
  invoice: Invoice | null
  hiddenOnMobile: boolean
  onBack: () => void
}

function InvoiceDetailPane({ invoice, hiddenOnMobile, onBack }: InvoiceDetailPaneProps): JSX.Element {
  return (
    <main className={cn('flex-1 overflow-y-auto bg-gray-50', hiddenOnMobile ? 'hidden sm:block' : 'block')}>
      {invoice !== null
        ? (
          <PageContainer>
            <Button variant="ghost" size="sm" className="sm:hidden mb-3 -ml-2" onClick={onBack}>
              <ArrowLeft size={15} className="mr-1.5" /> Back to invoices
            </Button>
            <InvoiceDetail invoice={invoice} />
          </PageContainer>
        )
        : <div className="hidden sm:flex items-center justify-center h-full text-sm text-gray-400">Select an invoice</div>
      }
    </main>
  )
}

export default function InvoicesPage(): JSX.Element {
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices()
  const { data: orders = [], isLoading: isLoadingOrders } = useOrders()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // On mobile, the list and detail panes are mutually exclusive (not stacked) —
  // this tracks which one to show; irrelevant at sm: and up, where both show.
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { mutate: generate, isPending: isGenerating } = useGenerateInvoice()
  const [searchParams] = useSearchParams()
  const selected = invoices.find((i) => i.id === selectedId) ?? invoices[0] ?? null

  function selectInvoice(id: string): void {
    setSelectedId(id)
    setMobileShowDetail(true)
  }

  // ?invoice=<id> deep link from a notification. Only selects an invoice this
  // tenant actually has — an unknown id falls back to the default selection.
  const invoiceParam = searchParams.get('invoice')
  useEffect(() => {
    if (!invoiceParam) return
    if (invoices.some((i) => i.id === invoiceParam)) selectInvoice(invoiceParam)
  }, [invoiceParam, invoices])

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
      onSuccess: (invoice) => selectInvoice(invoice.id),
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
    <div className="flex flex-col sm:flex-row h-[calc(100vh-60px)]">
      <InvoiceListPane
        invoices={invoices}
        selectedId={selected?.id}
        onSelect={selectInvoice}
        eligibleOrders={eligibleOrders}
        selectedOrderId={selectedOrderId}
        onSelectedOrderIdChange={setSelectedOrderId}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        error={error}
        hiddenOnMobile={mobileShowDetail}
      />
      <InvoiceDetailPane invoice={selected} hiddenOnMobile={!mobileShowDetail} onBack={() => setMobileShowDetail(false)} />
    </div>
  )
}
