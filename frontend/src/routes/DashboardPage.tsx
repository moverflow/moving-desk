import type { JSX } from 'react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth.store'
import { useDashboard } from '@/hooks/useDashboard'
import { cn, formatCurrency } from '@/lib/utils'
import type {
  DashboardCrewRow,
  DashboardPeriod,
  DashboardStatusRow,
  DashboardSummary,
  DashboardWeekRow,
} from '@/types'

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
]

const STATUS_ORDER = ['new', 'confirmed', 'in_progress', 'completed', 'closed', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

const CHART_COLOR = '#1d9e75'
const GRID_COLOR = '#e5e7eb'
const AXIS_COLOR = '#6b7280'

function PeriodSelector({ value, onChange }: { value: DashboardPeriod; onChange: (p: DashboardPeriod) => void }): JSX.Element {
  return (
    <div className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            'px-3 py-1.5 text-[13px] font-medium rounded transition-colors',
            value === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function SummaryCards({ summary }: { summary: DashboardSummary }): JSX.Element {
  const cards = [
    { label: 'Total orders', value: summary.totalOrders.toLocaleString('en-US') },
    { label: 'Revenue', value: formatCurrency(summary.totalRevenue) },
    { label: 'Avg order value', value: formatCurrency(summary.avgOrderValue) },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface ChartTooltipPayload {
  payload: DashboardWeekRow
}

function WeeklyChartTooltip({ active, payload }: { active?: boolean; payload?: ChartTooltipPayload[] }): JSX.Element | null {
  if (!active || !payload?.length) return null
  const { week, orders, revenue } = payload[0].payload
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-900 mb-1">{week}</p>
      <p className="text-gray-500">{formatCurrency(revenue)} revenue</p>
      <p className="text-gray-500">{orders} order{orders === 1 ? '' : 's'}</p>
    </div>
  )
}

function WeeklyChart({ data }: { data: DashboardWeekRow[] }): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-0">
        <p className="text-sm font-semibold text-gray-900">Orders &amp; revenue by week</p>
        <p className="text-xs text-gray-500">Last 8 weeks, by revenue</p>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v.toLocaleString('en-US')}`}
              width={64}
            />
            <Tooltip content={<WeeklyChartTooltip />} cursor={{ fill: 'rgba(29, 158, 117, 0.06)' }} />
            <Bar dataKey="revenue" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function StatusPanel({ rows }: { rows: DashboardStatusRow[] }): JSX.Element {
  const byStatus = new Map(rows.map((r) => [r.status, r]))
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-semibold text-gray-900">Orders by status</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {STATUS_ORDER.filter((s) => byStatus.has(s)).map((status) => {
          const row = byStatus.get(status) as DashboardStatusRow
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
          return (
            <div key={status} className="relative overflow-hidden rounded-md">
              <div className="absolute inset-y-0 left-0 bg-[#1d9e75]/10" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700">{STATUS_LABELS[status] ?? status}</span>
                <span className="flex items-center gap-3 text-gray-900">
                  <span className="font-medium">{row.count}</span>
                  <span className="text-xs text-gray-500">{formatCurrency(row.revenue)}</span>
                </span>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <p className="text-sm text-gray-500 py-2">No orders in this period.</p>}
      </CardContent>
    </Card>
  )
}

function TopCrewsTable({ crews }: { crews: DashboardCrewRow[] }): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-semibold text-gray-900">Top crews</p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2">Crew</th>
              <th className="px-4 py-2 text-center">Orders</th>
              <th className="px-4 py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {crews.map((crew) => (
              <tr key={crew.crewName} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-gray-900 font-medium">{crew.crewName}</div>
                  {crew.truckLabel && <div className="text-xs text-gray-500">{crew.truckLabel}</div>}
                </td>
                <td className="px-4 py-2.5 text-center text-gray-700">{crew.ordersCount}</td>
                <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{formatCurrency(crew.revenue)}</td>
              </tr>
            ))}
            {crews.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">No completed orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage(): JSX.Element {
  const role = useAuthStore((s) => s.user?.role)
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const { data, isLoading } = useDashboard(period)

  if (role !== 'owner') return <Navigate to="/orders" replace />

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading || !data
        ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        )
        : (
          <>
            <SummaryCards summary={data.summary} />
            <WeeklyChart data={data.ordersByWeek} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StatusPanel rows={data.ordersByStatus} />
              <TopCrewsTable crews={data.topCrews} />
            </div>
          </>
        )}
    </div>
  )
}
