import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orders } from '../db/schema.js'

export async function listClients(tenantId: string, search?: string) {
  return db
    .select({
      id: clients.id,
      tenant_id: clients.tenant_id,
      name: clients.name,
      phone: clients.phone,
      email: clients.email,
      notes: clients.notes,
      created_at: clients.created_at,
      orderCount: sql<number>`cast(count(${orders.id}) as int)`,
    })
    .from(clients)
    .leftJoin(
      orders,
      and(eq(orders.client_id, clients.id), eq(orders.tenant_id, tenantId))
    )
    .where(
      and(
        eq(clients.tenant_id, tenantId),
        search
          ? or(ilike(clients.name, `%${search}%`), ilike(clients.phone, `%${search}%`))
          : undefined
      )
    )
    .groupBy(
      clients.id,
      clients.tenant_id,
      clients.name,
      clients.phone,
      clients.email,
      clients.notes,
      clients.created_at
    )
}

export async function getClientById(tenantId: string, clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)))
    .limit(1)

  if (!client) return null

  const clientOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.client_id, clientId), eq(orders.tenant_id, tenantId)))

  return { ...client, orders: clientOrders }
}

export async function updateClient(
  tenantId: string,
  clientId: string,
  updates: { name?: string; email?: string | null; notes?: string | null }
) {
  const set: { name?: string; email?: string | null; notes?: string | null } = {}
  if (updates.name !== undefined) set.name = updates.name
  if (updates.email !== undefined) set.email = updates.email
  if (updates.notes !== undefined) set.notes = updates.notes

  const [updated] = await db
    .update(clients)
    .set(set)
    .where(and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}
