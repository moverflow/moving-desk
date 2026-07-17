import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orders } from '../db/schema.js'
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

// Today + tomorrow jobs assigned to this crew (UTC dates, matching how move_date
// is stored). Always scoped by tenant AND crew — a crew member only ever sees
// their own crew's work. Cancelled/closed jobs are hidden from the field view.
export async function getCrewJobs(tenantId: string, crewId: string) {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]

  return db
    .select(crewJobFields)
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        eq(orders.crew_id, crewId),
        inArray(orders.move_date, [today, tomorrow]),
        notInArray(orders.status, ['cancelled', 'closed']),
      ),
    )
    .orderBy(asc(orders.move_date))
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
