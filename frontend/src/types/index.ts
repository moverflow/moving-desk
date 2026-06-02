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

export interface CreateOrderData {
  clientName: string
  phone: string
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
