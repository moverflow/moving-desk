import { and, count, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, crews, orders, tenants } from '../db/schema.js'
import type { HomeSize, TenantSettings } from '../types/index.js'

const ACTIVE_ORDER_STATUSES = ['new', 'confirmed', 'in_progress'] as const

const DEFAULT_BASE_RATES: TenantSettings['baseRates'] = {
  studio: 280,
  '1br': 380,
  '2br': 480,
  '3br': 620,
  house: 850,
}
const DEFAULT_PACKING_FEE = 120

export interface PublicTenant {
  id: string
  name: string
  logoUrl: string | null
  phone: string | null
  description: string | null
  slug: string
  baseRates: TenantSettings['baseRates']
  packingFee: number
}

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      logo_url: tenants.logo_url,
      settings: tenants.settings,
      slug: tenants.slug,
      booking_enabled: tenants.booking_enabled,
      booking_description: tenants.booking_description,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)

  if (!tenant || !tenant.booking_enabled) return null

  const settings = (tenant.settings ?? {}) as Partial<TenantSettings>
  return {
    id: tenant.id,
    name: tenant.name,
    logoUrl: tenant.logo_url,
    phone: settings.phone ?? null,
    description: tenant.booking_description ?? null,
    slug: tenant.slug,
    baseRates: { ...DEFAULT_BASE_RATES, ...settings.baseRates },
    packingFee: settings.packingFee ?? DEFAULT_PACKING_FEE,
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function countActiveCrews(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(crews)
    .where(and(eq(crews.tenant_id, tenantId), eq(crews.active, true)))
  return row?.value ?? 0
}

export async function getAvailability(tenantId: string, month: string): Promise<string[]> {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNum = Number(monthStr)
  const total = daysInMonth(year, monthNum)
  const firstDay = `${month}-01`
  const lastDay = `${month}-${String(total).padStart(2, '0')}`

  const crewCount = await countActiveCrews(tenantId)
  if (crewCount === 0) return []

  const rows = await db
    .select({ moveDate: orders.move_date, value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        inArray(orders.status, [...ACTIVE_ORDER_STATUSES]),
        gte(orders.move_date, firstDay),
        lte(orders.move_date, lastDay)
      )
    )
    .groupBy(orders.move_date)

  const bookedByDate = new Map(rows.map((r) => [r.moveDate, r.value]))
  const today = todayIso()

  const available: string[] = []
  for (let day = 1; day <= total; day++) {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    if (iso < today) continue
    if ((bookedByDate.get(iso) ?? 0) < crewCount) available.push(iso)
  }
  return available
}

export async function isDateAvailable(tenantId: string, date: string): Promise<boolean> {
  if (date < todayIso()) return false

  const crewCount = await countActiveCrews(tenantId)
  if (crewCount === 0) return false

  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        inArray(orders.status, [...ACTIVE_ORDER_STATUSES]),
        eq(orders.move_date, date)
      )
    )
  return (row?.value ?? 0) < crewCount
}

async function findOrCreateBookingClient(
  tenantId: string,
  phone: string,
  name: string,
  email?: string
): Promise<string> {
  const [existing] = await db
    .select({ id: clients.id, email: clients.email })
    .from(clients)
    .where(and(eq(clients.tenant_id, tenantId), eq(clients.phone, phone)))
    .limit(1)

  if (existing) {
    if (email && !existing.email) {
      await db
        .update(clients)
        .set({ email })
        .where(and(eq(clients.id, existing.id), eq(clients.tenant_id, tenantId)))
    }
    return existing.id
  }

  const [created] = await db
    .insert(clients)
    .values({ tenant_id: tenantId, name, phone, ...(email ? { email } : {}) })
    .returning({ id: clients.id })
  return created.id
}

export interface BookingInput {
  clientName: string
  clientPhone: string
  clientEmail?: string
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: HomeSize
  fromFloor: number
  toFloor: number
  fromElevator: boolean
  toElevator: boolean
  packing: boolean
  notes?: string
}

export interface CreatedBooking {
  orderId: string
  totalPrice: number
  clientAlreadyBookedDate: boolean
}

export async function createBooking(
  tenant: PublicTenant,
  input: BookingInput
): Promise<CreatedBooking | null> {
  const available = await isDateAvailable(tenant.id, input.moveDate)
  if (!available) return null

  const clientId = await findOrCreateBookingClient(
    tenant.id,
    input.clientPhone,
    input.clientName,
    input.clientEmail
  )

  const [duplicate] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenant.id),
        eq(orders.client_id, clientId),
        eq(orders.move_date, input.moveDate),
        inArray(orders.status, [...ACTIVE_ORDER_STATUSES])
      )
    )
    .limit(1)
  if (duplicate) {
    return { orderId: duplicate.id, totalPrice: 0, clientAlreadyBookedDate: true }
  }

  const basePrice = tenant.baseRates[input.homeSize] ?? 0
  const totalPrice = basePrice + (input.packing ? tenant.packingFee : 0)

  const [order] = await db
    .insert(orders)
    .values({
      tenant_id: tenant.id,
      client_id: clientId,
      created_by: null,
      status: 'new',
      move_date: input.moveDate,
      from_address: input.fromAddress,
      to_address: input.toAddress,
      from_floor: input.fromFloor,
      to_floor: input.toFloor,
      from_elevator: input.fromElevator,
      to_elevator: input.toElevator,
      home_size: input.homeSize,
      packing: input.packing,
      notes: input.notes,
      base_price: basePrice,
      total_price: totalPrice,
    })
    .returning({ id: orders.id })

  return { orderId: order.id, totalPrice, clientAlreadyBookedDate: false }
}
