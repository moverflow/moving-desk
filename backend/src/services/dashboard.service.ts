import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crews, orders } from '../db/schema.js'

export type DashboardPeriod = 'week' | 'month' | 'quarter'

export interface DashboardSummary {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  totalRevenue: number
  avgOrderValue: number
}

export interface OrdersByStatusRow {
  status: string
  count: number
  revenue: number
}

export interface OrdersByWeekRow {
  week: string
  orders: number
  revenue: number
}

export interface TopCrewRow {
  crewName: string
  truckLabel: string
  ordersCount: number
  revenue: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function getPeriodStart(period: DashboardPeriod): Date {
  const now = new Date()
  if (period === 'week') return new Date(now.getTime() - WEEK_MS)

  const start = new Date(now)
  start.setMonth(start.getMonth() - (period === 'quarter' ? 3 : 1))
  return start
}

function formatWeekLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export async function getSummary(tenantId: string, period: DashboardPeriod): Promise<DashboardSummary> {
  const periodStart = getPeriodStart(period)

  const [row] = await db
    .select({
      totalOrders: sql<number>`cast(count(${orders.id}) as int)`,
      completedOrders: sql<number>`cast(count(*) filter (where ${orders.status} = 'completed') as int)`,
      cancelledOrders: sql<number>`cast(count(*) filter (where ${orders.status} = 'cancelled') as int)`,
      totalRevenue: sql<number>`cast(coalesce(sum(${orders.total_price}) filter (where ${orders.status} = 'completed'), 0) as int)`,
    })
    .from(orders)
    .where(and(eq(orders.tenant_id, tenantId), gte(orders.created_at, periodStart)))

  const totalOrders = row?.totalOrders ?? 0
  const completedOrders = row?.completedOrders ?? 0
  const cancelledOrders = row?.cancelledOrders ?? 0
  const totalRevenue = row?.totalRevenue ?? 0
  const avgOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0

  return { totalOrders, completedOrders, cancelledOrders, totalRevenue, avgOrderValue }
}

export async function getOrdersByStatus(
  tenantId: string,
  period: DashboardPeriod
): Promise<OrdersByStatusRow[]> {
  const periodStart = getPeriodStart(period)

  return db
    .select({
      status: orders.status,
      count: sql<number>`cast(count(${orders.id}) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${orders.total_price}), 0) as int)`,
    })
    .from(orders)
    .where(and(eq(orders.tenant_id, tenantId), gte(orders.created_at, periodStart)))
    .groupBy(orders.status)
}

export async function getOrdersByWeek(tenantId: string): Promise<OrdersByWeekRow[]> {
  const eightWeeksAgo = new Date(Date.now() - 8 * WEEK_MS).toISOString().slice(0, 10)

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${orders.move_date}), 'YYYY-MM-DD')`,
      ordersCount: sql<number>`cast(count(${orders.id}) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${orders.total_price}), 0) as int)`,
    })
    .from(orders)
    .where(and(eq(orders.tenant_id, tenantId), gte(orders.move_date, eightWeeksAgo)))
    .groupBy(sql`date_trunc('week', ${orders.move_date})`)
    .orderBy(sql`date_trunc('week', ${orders.move_date}) asc`)

  return rows.map((r) => ({ week: formatWeekLabel(r.week), orders: r.ordersCount, revenue: r.revenue }))
}

export async function getTopCrews(tenantId: string, period: DashboardPeriod): Promise<TopCrewRow[]> {
  const periodStart = getPeriodStart(period)

  return db
    .select({
      crewName: crews.name,
      truckLabel: sql<string>`coalesce(${crews.truck_label}, '')`,
      ordersCount: sql<number>`cast(count(${orders.id}) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${orders.total_price}), 0) as int)`,
    })
    .from(orders)
    .innerJoin(crews, and(eq(crews.id, orders.crew_id), eq(crews.tenant_id, tenantId)))
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        eq(orders.status, 'completed'),
        gte(orders.created_at, periodStart)
      )
    )
    .groupBy(crews.id, crews.name, crews.truck_label)
    .orderBy(desc(sql`sum(${orders.total_price})`))
    .limit(5)
}
