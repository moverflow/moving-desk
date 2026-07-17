export type UserRole = 'owner' | 'dispatcher' | 'crew'

export type Plan = 'trial' | 'basic' | 'pro'

export type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'

export type HomeSize = 'studio' | '1br' | '2br' | '3br' | 'house'

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'booked' | 'lost'

export type LeadSource = 'manual' | 'booking_page' | 'zapier' | 'phone'

export type { TenantSettings } from '../db/schema.js'

export type AppVariables = {
  userId: string
  tenantId: string
  role: string
  plan: string
  crewId: string | null
}

export interface JwtPayload {
  sub: string
  tenantId: string
  role: UserRole
  plan: Plan
  crewId?: string
  iat: number
  exp: number
}
