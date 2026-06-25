import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db'
import { clients, invoices, orders, tenants } from '../db/schema'

export async function generateInvoice(tenantId: string, orderId: string) {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenant_id, tenantId)))
    .limit(1)

  if (!order) return null

  const [countRow] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(invoices)
    .where(eq(invoices.tenant_id, tenantId))

  const nextNum = (countRow?.value ?? 0) + 1001
  const number = `INV-${nextNum}`

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const [invoice] = await db
    .insert(invoices)
    .values({ tenant_id: tenantId, order_id: orderId, number, status: 'draft', expires_at: expiresAt })
    .returning()

  return invoice
}

export async function listInvoices(tenantId: string) {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.tenant_id, tenantId))
}

export async function getInvoiceById(tenantId: string, invoiceId: string) {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
    .limit(1)
  return rows[0] ?? null
}

export async function updateInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  status: 'sent' | 'paid'
) {
  const set: { status: 'sent' | 'paid'; sent_at?: Date; paid_at?: Date } = { status }
  if (status === 'sent') set.sent_at = new Date()
  if (status === 'paid') set.paid_at = new Date()

  const [updated] = await db
    .update(invoices)
    .set(set)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}

export async function getInvoiceSendData(tenantId: string, invoiceId: string) {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      share_token: invoices.share_token,
      clientEmail: clients.email,
      clientName: clients.name,
      companyName: tenants.name,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.order_id))
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .innerJoin(tenants, eq(tenants.id, invoices.tenant_id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
    .limit(1)
  return rows[0] ?? null
}

export async function markInvoiceSent(tenantId: string, invoiceId: string) {
  const [updated] = await db
    .update(invoices)
    .set({ status: 'sent', sent_at: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}

export async function getPublicInvoice(token: string) {
  const rows = await db
    .select({
      invoiceId: invoices.id,
      number: invoices.number,
      status: invoices.status,
      createdAt: invoices.created_at,
      fromAddress: orders.from_address,
      toAddress: orders.to_address,
      moveDate: orders.move_date,
      homeSize: orders.home_size,
      packing: orders.packing,
      basePrice: orders.base_price,
      totalPrice: orders.total_price,
      clientName: clients.name,
      clientPhone: clients.phone,
      companyName: tenants.name,
      companyLogoUrl: tenants.logo_url,
      companySettings: tenants.settings,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.order_id))
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .innerJoin(tenants, eq(tenants.id, invoices.tenant_id))
    .where(and(eq(invoices.share_token, token), gt(invoices.expires_at, new Date())))
    .limit(1)
  return rows[0] ?? null
}
