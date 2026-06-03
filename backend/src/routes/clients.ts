import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { getClientById, listClients, updateClient } from '../services/clients.service'
import type { AppVariables } from '../types'

const patchClientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const clientsRouter = new Hono<{ Variables: AppVariables }>()

clientsRouter.get('/', authMiddleware, async (c) => {
  const { search } = c.req.query()
  const list = await listClients(c.get('tenantId'), search || undefined)
  return c.json({ clients: list })
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
