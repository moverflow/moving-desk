import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireOwner } from '../middleware/auth.js'
import {
  getOrdersByStatus,
  getOrdersByWeek,
  getSummary,
  getTopCrews,
} from '../services/dashboard.service.js'
import type { AppVariables } from '../types/index.js'

const dashboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).optional(),
})

const dashboardRouter = new Hono<{ Variables: AppVariables }>()

dashboardRouter.get('/', authMiddleware, requireOwner, async (c) => {
  const parsed = dashboardQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400)

  const period = parsed.data.period ?? 'month'
  const tenantId = c.get('tenantId')

  const [summary, ordersByStatus, ordersByWeek, topCrews] = await Promise.all([
    getSummary(tenantId, period),
    getOrdersByStatus(tenantId, period),
    getOrdersByWeek(tenantId),
    getTopCrews(tenantId, period),
  ])

  return c.json({ period, summary, ordersByStatus, ordersByWeek, topCrews })
})

export default dashboardRouter
