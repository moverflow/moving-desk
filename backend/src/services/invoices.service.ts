import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, invoices, orders, tenants } from '../db/schema.js'
import { env } from '../lib/env.js'
import { stripe } from '../lib/stripe.js'

function formatMoveDate(moveDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${moveDate}T00:00:00Z`))
}

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
    .select({
      id: invoices.id,
      tenant_id: invoices.tenant_id,
      order_id: invoices.order_id,
      number: invoices.number,
      status: invoices.status,
      share_token: invoices.share_token,
      sent_at: invoices.sent_at,
      paid_at: invoices.paid_at,
      expires_at: invoices.expires_at,
      created_at: invoices.created_at,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
      fromAddress: orders.from_address,
      toAddress: orders.to_address,
      moveDate: orders.move_date,
      homeSize: orders.home_size,
      packing: orders.packing,
      basePrice: orders.base_price,
      totalPrice: orders.total_price,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.order_id))
    .leftJoin(clients, eq(clients.id, orders.client_id))
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
      clientId: clients.id,
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

export type PaymentLinkResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; reason: 'not_found' | 'invalid_status' }

async function getPayableInvoiceByToken(token: string) {
  const [row] = await db
    .select({
      invoiceId: invoices.id,
      tenantId: invoices.tenant_id,
      status: invoices.status,
      shareToken: invoices.share_token,
      orderId: orders.id,
      homeSize: orders.home_size,
      fromAddress: orders.from_address,
      toAddress: orders.to_address,
      moveDate: orders.move_date,
      totalPrice: orders.total_price,
      clientEmail: clients.email,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.order_id))
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .where(and(eq(invoices.share_token, token), gt(invoices.expires_at, new Date())))
    .limit(1)
  return row ?? null
}

// Public: authorized by the invoice share token (the client is not logged in).
// The token is unique per invoice, so this inherently scopes to that invoice's
// own tenant — no cross-tenant access is possible.
export async function createInvoicePaymentLink(token: string): Promise<PaymentLinkResult> {
  const row = await getPayableInvoiceByToken(token)
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.status !== 'sent') return { ok: false, reason: 'invalid_status' }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Moving service — ${row.homeSize.toUpperCase()}`,
            description: `${row.fromAddress} → ${row.toAddress}, ${formatMoveDate(row.moveDate)}`,
          },
          unit_amount: row.totalPrice * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${env.FRONTEND_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/i/${row.shareToken}`,
    metadata: {
      invoiceId: row.invoiceId,
      tenantId: row.tenantId,
      orderId: row.orderId,
    },
    ...(row.clientEmail ? { customer_email: row.clientEmail } : {}),
  })

  await db
    .update(invoices)
    .set({ stripe_checkout_session_id: session.id })
    .where(eq(invoices.id, row.invoiceId))

  if (!session.url) return { ok: false, reason: 'not_found' }
  return { ok: true, checkoutUrl: session.url }
}

export interface PaidInvoiceInfo {
  number: string
  moveDate: string
  clientEmail: string | null
  clientName: string | null
  companyName: string
  amount: number
}

async function getPaidInvoiceEmailData(invoiceId: string) {
  const [row] = await db
    .select({
      number: invoices.number,
      moveDate: orders.move_date,
      clientEmail: clients.email,
      clientName: clients.name,
      companyName: tenants.name,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.order_id))
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .innerJoin(tenants, eq(tenants.id, invoices.tenant_id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)
  return row ?? null
}

// Marks an invoice paid from a Stripe checkout session. Guards on status so a
// webhook replay of the same event is a no-op (returns null) and never
// re-sends the confirmation email. Trusted context: verified webhook, no tenant.
export async function markInvoicePaidFromSession(params: {
  invoiceId: string
  paymentIntentId: string | null
  amountTotal: number | null
}): Promise<PaidInvoiceInfo | null> {
  const paidAmount = params.amountTotal !== null ? Math.round(params.amountTotal / 100) : null

  const [updated] = await db
    .update(invoices)
    .set({
      status: 'paid',
      paid_at: new Date(),
      paid_amount: paidAmount,
      stripe_payment_intent_id: params.paymentIntentId,
    })
    .where(and(eq(invoices.id, params.invoiceId), sql`${invoices.status} <> 'paid'`))
    .returning({ id: invoices.id })

  if (!updated) return null

  const row = await getPaidInvoiceEmailData(params.invoiceId)
  if (!row) return null

  return {
    number: row.number,
    moveDate: formatMoveDate(row.moveDate),
    clientEmail: row.clientEmail,
    clientName: row.clientName,
    companyName: row.companyName,
    amount: paidAmount ?? 0,
  }
}

export async function getPublicInvoice(token: string) {
  const rows = await db
    .select({
      invoiceId: invoices.id,
      number: invoices.number,
      status: invoices.status,
      paidAt: invoices.paid_at,
      stripeSessionId: invoices.stripe_checkout_session_id,
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
