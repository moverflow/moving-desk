import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireCrew } from '../middleware/auth.js'
import { resolveOrderFileUrl } from '../lib/r2.js'
import { getCrewJob, getCrewJobs, setCrewJobStatus } from '../services/crew.service.js'
import { listOrderFiles } from '../services/files.service.js'
import { sendOrderCompletedEmail } from '../services/orders.service.js'
import type { AppVariables } from '../types/index.js'

const statusSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
})

const crewRouter = new Hono<{ Variables: AppVariables }>()

crewRouter.get('/jobs', authMiddleware, requireCrew, async (c) => {
  const tenantId = c.get('tenantId')
  const crewId = c.get('crewId')
  if (!crewId) return c.json({ jobs: [] })

  const jobs = await getCrewJobs(tenantId, crewId)
  return c.json({ jobs })
})

crewRouter.patch('/jobs/:id/status', authMiddleware, requireCrew, async (c) => {
  const tenantId = c.get('tenantId')
  const crewId = c.get('crewId')
  const orderId = c.req.param('id')
  if (!crewId) return c.json({ error: 'Not found' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Crew can only set in_progress or completed' }, 422)
  }

  const result = statusSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Crew can only set in_progress or completed' }, 422)
  }

  const updated = await setCrewJobStatus(tenantId, crewId, orderId, result.data.status)
  if (!updated) return c.json({ error: 'Not found' }, 404)

  // Same downstream side effect as a dispatcher completing an order.
  if (result.data.status === 'completed') {
    await sendOrderCompletedEmail(tenantId, orderId)
  }

  return c.json({ success: true, status: updated.status })
})

crewRouter.get('/jobs/:id/files', authMiddleware, requireCrew, async (c) => {
  const tenantId = c.get('tenantId')
  const crewId = c.get('crewId')
  const orderId = c.req.param('id')
  if (!crewId) return c.json({ error: 'Not found' }, 404)

  const job = await getCrewJob(tenantId, crewId, orderId)
  if (!job) return c.json({ error: 'Not found' }, 404)

  const files = await listOrderFiles(tenantId, orderId)
  const resolved = files.map((f) => ({ id: f.id, name: f.name, url: resolveOrderFileUrl(f.key) }))
  return c.json({ files: resolved })
})

export default crewRouter
