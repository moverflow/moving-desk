import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { deleteOrderFile, uploadOrderFile } from '../lib/r2.js'
import {
  countOrderFiles,
  createOrderFileRecord,
  deleteOrderFileRecord,
  getOrderFileById,
  listOrderFiles,
  MAX_FILES_PER_ORDER,
} from '../services/files.service.js'
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
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_ORDER_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

const createOrderSchema = z.object({
  clientPhone: z.string().min(1),
  clientName: z.string().min(2),
  clientEmail: z.string().email().optional(),
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

  const clientId = await findOrCreateClient(tenantId, d.clientPhone, d.clientName, d.clientEmail)
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

ordersRouter.get('/:id/files', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const orderId = c.req.param('id')
  const order = await getOrderById(tenantId, orderId)
  if (!order) return c.json({ error: 'Order not found' }, 404)

  const files = await listOrderFiles(tenantId, orderId)
  return c.json({ files })
})

ordersRouter.post('/:id/files', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const orderId = c.req.param('id')
  const order = await getOrderById(tenantId, orderId)
  if (!order) return c.json({ error: 'Order not found' }, 404)

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ error: 'File required' }, 400)
  if (!ALLOWED_ORDER_FILE_TYPES.has(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: jpeg, png, webp, pdf' }, 400)
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return c.json({ error: 'File too large. Max size: 10MB' }, 400)
  }

  const existingCount = await countOrderFiles(tenantId, orderId)
  if (existingCount >= MAX_FILES_PER_ORDER) {
    return c.json({ error: `Max ${MAX_FILES_PER_ORDER} files per order` }, 409)
  }

  const { url, key } = await uploadOrderFile(file, tenantId, orderId)
  const created = await createOrderFileRecord({
    tenantId,
    orderId,
    name: file.name,
    url,
    key,
    size: file.size,
    mimeType: file.type,
    uploadedBy: c.get('userId'),
  })
  return c.json({ file: created }, 201)
})

ordersRouter.delete('/:id/files/:fileId', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const orderId = c.req.param('id')
  const fileId = c.req.param('fileId')

  const order = await getOrderById(tenantId, orderId)
  if (!order) return c.json({ error: 'Order not found' }, 404)

  const file = await getOrderFileById(tenantId, orderId, fileId)
  if (!file) return c.json({ error: 'File not found' }, 404)

  await deleteOrderFile(file.key)
  await deleteOrderFileRecord(tenantId, orderId, fileId)
  return c.json({ success: true })
})

export default ordersRouter
