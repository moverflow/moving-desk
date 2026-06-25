import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orders, tenants } from '../db/schema.js'
import type { HomeSize, OrderStatus, TenantSettings } from '../types/index.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['closed', 'cancelled'],
  closed: ['cancelled'],
}

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export async function listOrders(
  tenantId: string,
  filters: { status?: OrderStatus; date?: string; crewId?: string }
) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        filters.status ? eq(orders.status, filters.status) : undefined,
        filters.date ? eq(orders.move_date, filters.date) : undefined,
        filters.crewId ? eq(orders.crew_id, filters.crewId) : undefined,
      )
    )
    .orderBy(desc(orders.created_at))
}

export async function getOrderById(tenantId: string, orderId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenant_id, tenantId)))
    .limit(1)
  return rows[0] ?? null
}

export async function findOrCreateClient(
  tenantId: string,
  phone: string,
  name: string
): Promise<string> {
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.tenant_id, tenantId), eq(clients.phone, phone)))
    .limit(1)
  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(clients)
    .values({ tenant_id: tenantId, name, phone })
    .returning({ id: clients.id })
  return created.id
}

export async function getTenantBaseRates(tenantId: string): Promise<Record<string, number>> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  if (!tenant?.settings) return {}
  const settings = tenant.settings as Partial<TenantSettings>
  return settings.baseRates ?? {}
}

export async function createOrder(params: {
  tenantId: string
  clientId: string
  createdBy: string
  crewId?: string
  moveDate: string
  fromAddress: string
  toAddress: string
  fromFloor: number
  toFloor: number
  fromElevator: boolean
  toElevator: boolean
  homeSize: HomeSize
  packing: boolean
  notes?: string
  basePrice: number
  totalPrice: number
}) {
  const [order] = await db
    .insert(orders)
    .values({
      tenant_id: params.tenantId,
      client_id: params.clientId,
      created_by: params.createdBy,
      crew_id: params.crewId,
      status: 'new',
      move_date: params.moveDate,
      from_address: params.fromAddress,
      to_address: params.toAddress,
      from_floor: params.fromFloor,
      to_floor: params.toFloor,
      from_elevator: params.fromElevator,
      to_elevator: params.toElevator,
      home_size: params.homeSize,
      packing: params.packing,
      notes: params.notes,
      base_price: params.basePrice,
      total_price: params.totalPrice,
    })
    .returning()
  return order
}

export async function updateOrder(
  tenantId: string,
  orderId: string,
  updates: {
    status?: OrderStatus
    crewId?: string | null
    notes?: string | null
    moveDate?: string
    fromAddress?: string
    toAddress?: string
  }
) {
  const set: {
    status?: OrderStatus
    crew_id?: string | null
    notes?: string | null
    move_date?: string
    from_address?: string
    to_address?: string
    updated_at: Date
  } = { updated_at: new Date() }

  if (updates.status !== undefined) set.status = updates.status
  if (updates.crewId !== undefined) set.crew_id = updates.crewId
  if (updates.notes !== undefined) set.notes = updates.notes
  if (updates.moveDate !== undefined) set.move_date = updates.moveDate
  if (updates.fromAddress !== undefined) set.from_address = updates.fromAddress
  if (updates.toAddress !== undefined) set.to_address = updates.toAddress

  const [updated] = await db
    .update(orders)
    .set(set)
    .where(and(eq(orders.id, orderId), eq(orders.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}
