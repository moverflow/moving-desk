import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, leads, orders, tenants } from '../db/schema.js'
import type { HomeSize, LeadSource, LeadStatus } from '../types/index.js'

export interface CreateLeadInput {
  name: string
  phone?: string
  email?: string
  fromAddress?: string
  toAddress?: string
  moveDate?: string
  homeSize?: string
  notes?: string
  source?: LeadSource
}

export interface UpdateLeadInput {
  name?: string
  phone?: string | null
  email?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  moveDate?: string | null
  homeSize?: string | null
  notes?: string | null
  status?: LeadStatus
}

export async function createLead(tenantId: string, createdBy: string | null, input: CreateLeadInput) {
  const [lead] = await db
    .insert(leads)
    .values({
      tenant_id: tenantId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      from_address: input.fromAddress ?? null,
      to_address: input.toAddress ?? null,
      move_date: input.moveDate ?? null,
      home_size: input.homeSize ?? null,
      notes: input.notes ?? null,
      source: input.source ?? 'manual',
      created_by: createdBy,
    })
    .returning()
  return lead
}

export async function listLeads(
  tenantId: string,
  filters: { status?: LeadStatus; search?: string },
) {
  const search = filters.search?.trim()
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenant_id, tenantId),
        filters.status ? eq(leads.status, filters.status) : undefined,
        search
          ? or(
              ilike(leads.name, `%${search}%`),
              ilike(leads.phone, `%${search}%`),
              ilike(leads.email, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(leads.created_at))
}

export async function getLead(tenantId: string, leadId: string) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenant_id, tenantId)))
    .limit(1)
  return lead ?? null
}

export async function updateLead(tenantId: string, leadId: string, updates: UpdateLeadInput) {
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (updates.name !== undefined) set.name = updates.name
  if (updates.phone !== undefined) set.phone = updates.phone
  if (updates.email !== undefined) set.email = updates.email
  if (updates.fromAddress !== undefined) set.from_address = updates.fromAddress
  if (updates.toAddress !== undefined) set.to_address = updates.toAddress
  if (updates.moveDate !== undefined) set.move_date = updates.moveDate
  if (updates.homeSize !== undefined) set.home_size = updates.homeSize
  if (updates.notes !== undefined) set.notes = updates.notes
  if (updates.status !== undefined) set.status = updates.status

  const [updated] = await db
    .update(leads)
    .set(set)
    .where(and(eq(leads.id, leadId), eq(leads.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}

// Soft delete — leads are never hard-deleted so the pipeline keeps its history.
export async function markLeadLost(tenantId: string, leadId: string) {
  const [updated] = await db
    .update(leads)
    .set({ status: 'lost', updated_at: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}

async function findOrCreateClientForLead(
  tenantId: string,
  name: string,
  phone: string | null,
  email: string | null,
): Promise<string> {
  if (phone) {
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
  }

  const [created] = await db
    .insert(clients)
    .values({ tenant_id: tenantId, name, phone: phone ?? null, email: email ?? null })
    .returning({ id: clients.id })
  return created.id
}

export interface ConvertResult {
  orderId: string
}

// Converts a lead into a real order: finds/creates the client, pre-fills the
// order with whatever the lead has, and marks the lead booked with a back-link.
export async function convertLeadToOrder(
  tenantId: string,
  userId: string,
  leadId: string,
): Promise<ConvertResult | null> {
  const lead = await getLead(tenantId, leadId)
  if (!lead) return null

  const clientId = await findOrCreateClientForLead(tenantId, lead.name, lead.phone, lead.email)

  const todayDate = new Date().toISOString().split('T')[0]
  const [order] = await db
    .insert(orders)
    .values({
      tenant_id: tenantId,
      client_id: clientId,
      created_by: userId,
      status: 'new',
      from_address: lead.from_address ?? '',
      to_address: lead.to_address ?? '',
      move_date: lead.move_date ?? todayDate,
      home_size: (lead.home_size ?? '2br') as HomeSize,
      notes: lead.notes,
    })
    .returning({ id: orders.id })

  await db
    .update(leads)
    .set({ status: 'booked', converted_order_id: order.id, updated_at: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenant_id, tenantId)))

  return { orderId: order.id }
}

export async function findTenantBySlug(slug: string): Promise<{ id: string } | null> {
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
  return tenant ?? null
}
