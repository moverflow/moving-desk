import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { createClient, getClientById, listClients, updateClient } from '../services/clients.service.js'
import type { AppVariables } from '../types/index.js'

const patchClientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const createClientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
})

const clientsRouter = new Hono<{ Variables: AppVariables }>()

clientsRouter.get('/', authMiddleware, async (c) => {
  const { search } = c.req.query()
  const list = await listClients(c.get('tenantId'), search || undefined)
  return c.json({ clients: list })
})

clientsRouter.post('/', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = createClientSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  const client = await createClient(c.get('tenantId'), result.data)
  if (client === null) {
    return c.json({ error: 'Client with this phone already exists' }, 409)
  }
  return c.json({ client }, 201)
})

clientsRouter.get('/:id', authMiddleware, async (c) => {
  const client = await getClientById(c.get('tenantId'), c.req.param('id'))
  if (!client) return c.json({ error: 'Client not found' }, 404)
  return c.json({ client })
})

clientsRouter.patch('/:id', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = patchClientSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const updated = await updateClient(c.get('tenantId'), c.req.param('id'), result.data)
  if (!updated) return c.json({ error: 'Client not found' }, 404)
  return c.json({ client: updated })
})

export default clientsRouter
