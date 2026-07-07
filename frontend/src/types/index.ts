export interface User {
  id: string
  email: string
  name: string
  role: string
}

export interface Tenant {
  id: string
  name: string
  plan: string
}

export type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'
export type HomeSize = 'studio' | '1br' | '2br' | '3br' | 'house'

export interface Order {
  id: string
  tenantId: string
  clientName: string
  phone: string
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: HomeSize
  status: OrderStatus
  crewId?: string
  crewName?: string
  fromFloor: number
  toFloor: number
  fromElevator: boolean
  toElevator: boolean
  packing: boolean
  totalPrice: number
  notes?: string
  createdAt: string
}

export interface Crew {
  id: string
  name: string
  truckLabel: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface Invoice {
  id: string
  tenantId: string
  orderId: string
  number: string
  status: InvoiceStatus
  clientName: string
  clientPhone: string
  clientEmail: string
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: string
  packing: boolean
  basePrice: number
  totalPrice: number
  shareToken: string
  sentAt?: string
  paidAt?: string
  createdAt: string
}

export interface Company {
  name: string
  phone: string
  website: string
  logoUrl: string | null
}

export type UserRole = 'owner' | 'dispatcher'
export type SubscriptionPlan = 'trial' | 'basic' | 'pro'
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'past_due'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Settings {
  companyName: string
  logoUrl: string | null
  timezone: string
  baseRates: Record<string, number>
}

export interface Subscription {
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trialEndsAt?: string
}

export interface Client {
  id: string
  tenantId: string
  name: string
  phone: string
  email: string
  notes: string
  orderCount: number
  lastMoveDate?: string
  createdAt: string
}

export type DashboardPeriod = 'week' | 'month' | 'quarter'

export interface DashboardSummary {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  totalRevenue: number
  avgOrderValue: number
}

export interface DashboardStatusRow {
  status: string
  count: number
  revenue: number
}

export interface DashboardWeekRow {
  week: string
  orders: number
  revenue: number
}

export interface DashboardCrewRow {
  crewName: string
  truckLabel: string
  ordersCount: number
  revenue: number
}

export interface DashboardResponse {
  period: DashboardPeriod
  summary: DashboardSummary
  ordersByStatus: DashboardStatusRow[]
  ordersByWeek: DashboardWeekRow[]
  topCrews: DashboardCrewRow[]
}

export interface CreateOrderData {
  clientName: string
  phone: string
  clientEmail?: string
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: HomeSize
  crewId?: string
  fromFloor: number
  toFloor: number
  fromElevator: boolean
  toElevator: boolean
  packing: boolean
  notes?: string
}
