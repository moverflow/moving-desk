import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import {
  createOrder,
  findOrCreateClient,
  getOrderById,
  getTenantBaseRates,
  isValidTransition,
  listOrders,
  updateOrder,
} from '../services/orders.service.js'
import type { AppVariables } from '../types/index.js'

const PACKING_FEE = 12000 // $120 in cents

const createOrderSchema = z.object({
  clientPhone: z.string().min(1),
  clientName: z.string().min(2),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  moveDate: z.string().min(1),
  fromFloor: z.number().int().default(1),
  toFloor: z.number().int().default(1),
  fromElevator: z.boolean().default(false),
  toElevator: z.boolean().default(false),
  homeSize: z.enum(['studio', '1br', '2br', '3br', 'house']),
  packing: z.boolean().default(false),
  crewId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

const patchOrderSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'closed', 'cancelled']).optional(),
  crewId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  moveDate: z.string().optional(),
  fromAddress: z.string().min(1).optional(),
  toAddress: z.string().min(1).optional(),
})

const listOrdersQuerySchema = z.object({
  status: z.enum(['new', 'confirmed', 'in_progress', 'completed', 'closed', 'cancelled']).optional(),
  date: z.string().optional(),
  crew_id: z.string().uuid().optional(),
})

const ordersRouter = new Hono<{ Variables: AppVariables }>()

ordersRouter.get('/', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const parsed = listOrdersQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400)
  const { status, date, crew_id } = parsed.data
  const list = await listOrders(tenantId, { status, date, crewId: crew_id })
  return c.json({ orders: list, total: list.length })
})

ordersRouter.post('/', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = createOrderSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed', details: result.error.issues }, 400)

  const d = result.data
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')

  const clientId = await findOrCreateClient(tenantId, d.clientPhone, d.clientName)
  const baseRates = await getTenantBaseRates(tenantId)
  const basePrice = baseRates[d.homeSize] ?? 0
  const totalPrice = basePrice + (d.packing ? PACKING_FEE : 0)

  const order = await createOrder({
    tenantId, clientId, createdBy: userId, crewId: d.crewId,
    moveDate: d.moveDate, fromAddress: d.fromAddress, toAddress: d.toAddress,
    fromFloor: d.fromFloor, toFloor: d.toFloor,
    fromElevator: d.fromElevator, toElevator: d.toElevator,
    homeSize: d.homeSize, packing: d.packing, notes: d.notes,
    basePrice, totalPrice,
  })
  return c.json({ order }, 201)
})

ordersRouter.get('/:id', authMiddleware, async (c) => {
  const order = await getOrderById(c.get('tenantId'), c.req.param('id'))
  if (!order) return c.json({ error: 'Order not found' }, 404)
  return c.json({ order })
})

ordersRouter.patch('/:id', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = patchOrderSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const tenantId = c.get('tenantId')
  const orderId = c.req.param('id')
  const existing = await getOrderById(tenantId, orderId)
  if (!existing) return c.json({ error: 'Order not found' }, 404)

  const d = result.data
  if (d.status && !isValidTransition(existing.status, d.status)) {
    return c.json({ error: 'Invalid status transition' }, 422)
  }

  const updated = await updateOrder(tenantId, orderId, {
    status: d.status, crewId: d.crewId, notes: d.notes,
    moveDate: d.moveDate, fromAddress: d.fromAddress, toAddress: d.toAddress,
  })
  return c.json({ order: updated })
})

ordersRouter.delete('/:id', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const orderId = c.req.param('id')
  const existing = await getOrderById(tenantId, orderId)
  if (!existing) return c.json({ error: 'Order not found' }, 404)
  const updated = await updateOrder(tenantId, orderId, { status: 'cancelled' })
  return c.json({ order: updated })
})

export default ordersRouter
