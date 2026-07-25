import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'
import { resolveTimezone } from '../lib/timezone.js'
import type { TenantSettings } from '../types/index.js'

const DEFAULT_SETTINGS: TenantSettings = {
  timezone: 'America/New_York',
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
  packingFee: 120,
}

export const DEFAULT_PACKING_FEE = DEFAULT_SETTINGS.packingFee

export interface TenantPricing {
  baseRates: TenantSettings['baseRates']
  packingFee: number
}

// Single source of truth for what an order costs. Prices are whole US dollars,
// never cents. Deliberately mirrors the public booking path
// (booking.service.ts) so a move costs the same whether the dispatcher creates
// the order or the client books it themselves.
export async function getTenantPricing(tenantId: string): Promise<TenantPricing> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const settings = (tenant?.settings ?? {}) as Partial<TenantSettings>
  return {
    baseRates: { ...DEFAULT_SETTINGS.baseRates, ...settings.baseRates },
    packingFee: settings.packingFee ?? DEFAULT_SETTINGS.packingFee,
  }
}

// The zone every day-boundary calculation for this tenant must use.
export async function getTenantTimezone(tenantId: string): Promise<string> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const settings = (tenant?.settings ?? {}) as Partial<TenantSettings>
  return resolveTimezone(settings.timezone)
}

export async function getSettings(tenantId: string) {
  const [tenant] = await db
    .select({
      name: tenants.name,
      logo_url: tenants.logo_url,
      settings: tenants.settings,
      slug: tenants.slug,
      booking_enabled: tenants.booking_enabled,
      booking_description: tenants.booking_description,
    })
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
    packingFee?: number
    phone?: string | null
    bookingEnabled?: boolean
    bookingDescription?: string | null
    contractTerms?: string | null
  }
) {
  const [current] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const currentSettings = (current?.settings ?? DEFAULT_SETTINGS) as TenantSettings
  const merged: TenantSettings = { ...DEFAULT_SETTINGS, ...currentSettings }
  const settingsChanged =
    updates.timezone !== undefined ||
    updates.baseRates !== undefined ||
    updates.packingFee !== undefined ||
    updates.phone !== undefined ||
    updates.contractTerms !== undefined
  if (updates.timezone !== undefined) merged.timezone = updates.timezone
  if (updates.baseRates !== undefined) merged.baseRates = { ...merged.baseRates, ...updates.baseRates }
  if (updates.packingFee !== undefined) merged.packingFee = updates.packingFee
  if (updates.phone !== undefined) merged.phone = updates.phone ?? undefined
  if (updates.contractTerms !== undefined) {
    merged.contractTerms = updates.contractTerms?.trim() || undefined
  }

  const set: {
    name?: string
    logo_url?: string | null
    settings?: TenantSettings
    booking_enabled?: boolean
    booking_description?: string | null
  } = {}
  if (updates.name !== undefined) set.name = updates.name
  if (updates.logo_url !== undefined) set.logo_url = updates.logo_url
  if (settingsChanged) set.settings = merged
  if (updates.bookingEnabled !== undefined) set.booking_enabled = updates.bookingEnabled
  if (updates.bookingDescription !== undefined) set.booking_description = updates.bookingDescription

  const [updated] = await db
    .update(tenants)
    .set(set)
    .where(eq(tenants.id, tenantId))
    .returning({
      name: tenants.name,
      logo_url: tenants.logo_url,
      settings: tenants.settings,
      slug: tenants.slug,
      booking_enabled: tenants.booking_enabled,
      booking_description: tenants.booking_description,
    })
  return updated ?? null
}
