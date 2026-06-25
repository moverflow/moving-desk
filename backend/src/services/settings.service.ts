import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'
import type { TenantSettings } from '../types/index.js'

const DEFAULT_SETTINGS: TenantSettings = {
  timezone: 'America/New_York',
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
  packingFee: 120,
}

export async function getSettings(tenantId: string) {
  const [tenant] = await db
    .select({ name: tenants.name, logo_url: tenants.logo_url, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return tenant ?? null
}

export async function updateSettings(
  tenantId: string,
  updates: {
    name?: string
    logo_url?: string | null
    timezone?: string
    baseRates?: Partial<TenantSettings['baseRates']>
  }
) {
  const [current] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const currentSettings = (current?.settings ?? DEFAULT_SETTINGS) as TenantSettings
  const merged: TenantSettings = { ...DEFAULT_SETTINGS, ...currentSettings }
  if (updates.timezone !== undefined) merged.timezone = updates.timezone
  if (updates.baseRates !== undefined) merged.baseRates = { ...merged.baseRates, ...updates.baseRates }

  const set: {
    name?: string
    logo_url?: string | null
    settings?: TenantSettings
  } = {}
  if (updates.name !== undefined) set.name = updates.name
  if (updates.logo_url !== undefined) set.logo_url = updates.logo_url
  if (updates.timezone !== undefined || updates.baseRates !== undefined) set.settings = merged

  const [updated] = await db
    .update(tenants)
    .set(set)
    .where(eq(tenants.id, tenantId))
    .returning({ name: tenants.name, logo_url: tenants.logo_url, settings: tenants.settings })
  return updated ?? null
}
