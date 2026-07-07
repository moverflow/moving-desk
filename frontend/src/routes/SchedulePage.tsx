import type { JSX } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { Order, OrderStatus } from '@/types'
import { useOrders } from '@/hooks/useOrders'
import { HOME_SIZE_LABEL } from '@/components/shared/OrderCard'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CalendarView = 'timeGridWeek' | 'dayGridMonth'

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#378ADD',
  confirmed: '#EF9F27',
  in_progress: '#1D9E75',
  completed: '#B4B2A9',
  closed: '#B4B2A9',
  cancelled: '#E24B4A',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

interface OrderEventProps {
  clientName: string
  homeSizeLabel: string
  fromAddress: string
  toAddress: string
  crewName?: string
  status: OrderStatus
}

function orderToEvent(order: Order): {
  id: string
  title: string
  date: string
  backgroundColor: string
  borderColor: string
  extendedProps: OrderEventProps
} {
  const homeSizeLabel = HOME_SIZE_LABEL[order.homeSize] ?? order.homeSize
  return {
    id: order.id,
    title: `${order.clientName} — ${homeSizeLabel}`,
    date: order.moveDate,
    backgroundColor: STATUS_COLOR[order.status],
    borderColor: STATUS_COLOR[order.status],
    extendedProps: {
      clientName: order.clientName,
      homeSizeLabel,
      fromAddress: order.fromAddress,
      toAddress: order.toAddress,
      crewName: order.crewName,
      status: order.status,
    },
  }
}

function ViewToggle({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }): JSX.Element {
  const options: { value: CalendarView; label: string }[] = [
    { value: 'timeGridWeek', label: 'Week' },
    { value: 'dayGridMonth', label: 'Month' },
  ]
  return (
    <div className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 text-[13px] font-medium rounded transition-colors',
            view === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function EventContent({ event }: EventContentArg): JSX.Element {
  return <span className="truncate px-1 text-xs font-medium">{event.title}</span>
}

interface SelectedOrder {
  clientName: string
  homeSize: string
  fromAddress: string
  toAddress: string
  crewName?: string
  status: OrderStatus
}

function OrderDetailPanel({ order, onClose }: { order: SelectedOrder; onClose: () => void }): JSX.Element {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{order.clientName} — {order.homeSize}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-gray-500">{order.fromAddress} → {order.toAddress}</p>
          <p className="text-gray-500">{order.crewName ?? 'Unassigned'}</p>
          <p className="text-gray-500">Status: {STATUS_LABEL[order.status]}</p>
        </div>
        <Link to="/orders">
          <Button className="mt-6 w-full">View order →</Button>
        </Link>
      </SheetContent>
    </Sheet>
  )
}

export default function SchedulePage(): JSX.Element {
  const { data: orders, isLoading } = useOrders()
  const calendarRef = useRef<FullCalendar>(null)
  const [view, setView] = useState<CalendarView>('timeGridWeek')
  const [selected, setSelected] = useState<SelectedOrder | null>(null)

  const events = useMemo(() => (orders ?? []).map(orderToEvent), [orders])

  function handleViewChange(next: CalendarView): void {
    setView(next)
    calendarRef.current?.getApi().changeView(next)
  }

  function handleEventClick(arg: EventClickArg): void {
    const props = arg.event.extendedProps as OrderEventProps
    setSelected({
      clientName: props.clientName,
      homeSize: props.homeSizeLabel,
      fromAddress: props.fromAddress,
      toAddress: props.toAddress,
      crewName: props.crewName,
      status: props.status,
    })
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <ViewToggle view={view} onChange={handleViewChange} />
      </div>

      {isLoading
        ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        )
        : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            events={events}
            eventContent={EventContent}
            eventClick={handleEventClick}
            editable={false}
            selectable={false}
            height="auto"
          />
        )}

      {selected && <OrderDetailPanel order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
