import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orders } from '../db/schema.js'
import { addDays, getTenantToday } from '../lib/timezone.js'
import { getTenantTimezone } from './settings.service.js'
import type { OrderStatus } from '../types/index.js'

const crewJobFields = {
  id: orders.id,
  status: orders.status,
  moveDate: orders.move_date,
  fromAddress: orders.from_address,
  toAddress: orders.to_address,
  fromFloor: orders.from_floor,
  toFloor: orders.to_floor,
  fromElevator: orders.from_elevator,
  toElevator: orders.to_elevator,
  homeSize: orders.home_size,
  packing: orders.packing,
  notes: orders.notes,
  totalPrice: orders.total_price,
  clientName: clients.name,
  clientPhone: clients.phone,
}

export interface CrewJobsResult {
  jobs: Awaited<ReturnType<typeof selectCrewJobs>>
  today: string
  tomorrow: string
}

function selectCrewJobs(tenantId: string, crewId: string, days: string[]) {
  return db
    .select(crewJobFields)
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        eq(orders.crew_id, crewId),
        inArray(orders.move_date, days),
        notInArray(orders.status, ['cancelled', 'closed']),
      ),
    )
    .orderBy(asc(orders.move_date))
}

// Today + tomorrow jobs assigned to this crew, where "today" is the calendar
// date in the tenant's own timezone. Using UTC meant a California crew lost the
// job they were still working the moment it passed 5pm locally.
//
// The dates are returned alongside the jobs so the PWA labels the sections with
// the same boundary the query used, instead of recomputing it in the browser.
// Always scoped by tenant AND crew — a crew member only ever sees their own
// crew's work. Cancelled/closed jobs are hidden from the field view.
export async function getCrewJobs(tenantId: string, crewId: string): Promise<CrewJobsResult> {
  const timezone = await getTenantTimezone(tenantId)
  const today = getTenantToday(timezone)
  const tomorrow = addDays(today, 1)

  const jobs = await selectCrewJobs(tenantId, crewId, [today, tomorrow])
  return { jobs, today, tomorrow }
}

export async function getCrewJob(tenantId: string, crewId: string, orderId: string) {
  const rows = await db
    .select(crewJobFields)
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.crew_id, crewId),
        eq(orders.tenant_id, tenantId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

// Atomic status update: the WHERE enforces tenant + crew ownership, so a crew
// member can never touch another crew's order (AC3). Returns null if nothing
// matched (wrong crew / tenant / order id).
export async function setCrewJobStatus(
  tenantId: string,
  crewId: string,
  orderId: string,
  status: Extract<OrderStatus, 'in_progress' | 'completed'>,
) {
  const [updated] = await db
    .update(orders)
    .set({ status, updated_at: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.crew_id, crewId),
        eq(orders.tenant_id, tenantId),
      ),
    )
    .returning({ id: orders.id, status: orders.status })
  return updated ?? null
}
