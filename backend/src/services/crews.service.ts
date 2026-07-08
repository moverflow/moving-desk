import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crews } from '../db/schema.js'

export async function listCrews(tenantId: string) {
  return db
    .select()
    .from(crews)
    .where(and(eq(crews.tenant_id, tenantId), eq(crews.active, true)))
}

export async function createCrew(
  tenantId: string,
  name: string,
  truckLabel?: string,
  phone?: string
) {
  const [crew] = await db
    .insert(crews)
    .values({ tenant_id: tenantId, name, truck_label: truckLabel, phone })
    .returning()
  return crew
}

export async function updateCrew(
  tenantId: string,
  crewId: string,
  updates: { name?: string; truckLabel?: string; phone?: string; active?: boolean }
) {
  const set: { name?: string; truck_label?: string; phone?: string; active?: boolean } = {}
  if (updates.name !== undefined) set.name = updates.name
  if (updates.truckLabel !== undefined) set.truck_label = updates.truckLabel
  if (updates.phone !== undefined) set.phone = updates.phone
  if (updates.active !== undefined) set.active = updates.active

  const [updated] = await db
    .update(crews)
    .set(set)
    // tenantId filter — required by multi-tenancy rules
    .where(and(eq(crews.id, crewId), eq(crews.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}

export async function deactivateCrew(tenantId: string, crewId: string) {
  const [updated] = await db
    .update(crews)
    .set({ active: false })
    .where(and(eq(crews.id, crewId), eq(crews.tenant_id, tenantId)))
    .returning()
  return updated ?? null
}
