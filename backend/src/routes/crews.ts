import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { createCrew, deactivateCrew, listCrews, updateCrew } from '../services/crews.service.js'
import type { AppVariables } from '../types/index.js'

const createCrewSchema = z.object({
  name: z.string().min(1),
  truckLabel: z.string().optional(),
  phone: z.string().optional(),
})

const patchCrewSchema = z.object({
  name: z.string().min(1).optional(),
  truckLabel: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
})

const crewsRouter = new Hono<{ Variables: AppVariables }>()

crewsRouter.get('/', authMiddleware, async (c) => {
  const includeInactive = c.req.query('includeInactive') === 'true'
  const list = await listCrews(c.get('tenantId'), includeInactive)
  return c.json({ crews: list })
})

crewsRouter.post('/', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = createCrewSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const crew = await createCrew(
    c.get('tenantId'),
    result.data.name,
    result.data.truckLabel,
    result.data.phone
  )
  return c.json({ crew }, 201)
})

crewsRouter.patch('/:id', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = patchCrewSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const updated = await updateCrew(c.get('tenantId'), c.req.param('id'), {
    name: result.data.name,
    truckLabel: result.data.truckLabel,
    phone: result.data.phone,
    active: result.data.active,
  })
  if (!updated) return c.json({ error: 'Crew not found' }, 404)
  return c.json({ crew: updated })
})

crewsRouter.delete('/:id', authMiddleware, async (c) => {
  const updated = await deactivateCrew(c.get('tenantId'), c.req.param('id'))
  if (!updated) return c.json({ error: 'Crew not found' }, 404)
  return c.json({ crew: updated })
})

export default crewsRouter
