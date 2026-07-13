import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireOwner } from '../middleware/auth.js'
import {
  getOrdersByStatus,
  getOrdersByWeek,
  getSummary,
  getTopCrews,
} from '../services/dashboard.service.js'
import {
  generateChatReply,
  getCachedInsights,
  isAIConfigured,
  remainingQuestions,
} from '../services/ai.service.js'
import type { AppVariables } from '../types/index.js'

const dashboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).optional(),
})

const chatSchema = z.object({
  message: z.string().trim().min(1).max(500),
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

dashboardRouter.get('/ai-insights', authMiddleware, requireOwner, async (c) => {
  if (!isAIConfigured()) return c.json({ error: 'AI is not configured' }, 503)

  const result = await getCachedInsights(c.get('tenantId'))
  return c.json(result)
})

dashboardRouter.post('/ai-chat', authMiddleware, requireOwner, async (c) => {
  if (!isAIConfigured()) return c.json({ error: 'AI is not configured' }, 503)

  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400)

  const result = await generateChatReply(userId, c.get('tenantId'), parsed.data.message)
  if (!result) {
    return c.json({ error: 'Daily limit reached', questionsRemaining: remainingQuestions(userId) }, 429)
  }
  return c.json(result)
})

export default dashboardRouter
