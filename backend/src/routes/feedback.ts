import { Hono } from 'hono'
import { z } from 'zod'
import { resolveOptionalAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { createFeedback } from '../services/feedback.service.js'

// Publicly writable with no auth required, so bounded per IP like every other
// unauthenticated write endpoint (see book.ts). Testers submitting a handful
// of reports per session should never hit this; a script would.
const feedbackRateLimit = rateLimit({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many feedback submissions. Please try again later.',
})

const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  pageUrl: z.string().trim().min(1).max(2000),
  severity: z.enum(['bug', 'suggestion', 'other']).optional(),
})

const feedbackRouter = new Hono()

feedbackRouter.post('/', feedbackRateLimit, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }

  const result = feedbackSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  // Not a middleware gate: this route accepts both logged-in and anonymous
  // callers, so a missing/invalid token here means "anonymous," not 401.
  const auth = await resolveOptionalAuth(c)

  const row = await createFeedback({
    tenantId: auth?.tenantId ?? null,
    userId: auth?.userId ?? null,
    message: result.data.message,
    pageUrl: result.data.pageUrl,
    severity: result.data.severity,
  })

  return c.json({ success: true, id: row.id }, 201)
})

export default feedbackRouter
