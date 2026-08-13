import { Hono } from 'hono'
import { z } from 'zod'
import { isAIConfigured } from '../lib/anthropic.js'
import { isTelegramEnabled } from '../lib/telegram.js'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { linkSession, startSession } from '../services/assistant-auth.service.js'
import {
  AssistantUnavailableError,
  getTranscript,
  resolveAction,
  sendMessage,
} from '../services/assistant.service.js'
import type { AppVariables } from '../types/index.js'

const assistantRouter = new Hono<{ Variables: AppVariables }>()

// /session and /link are the only unauthenticated routes here: they are how a
// Mini App with no token gets one. Both burn a linking code or probe for a link,
// so they get the same budget as /auth/*.
const sessionRateLimit = rateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Too many attempts. Please reopen the assistant in a few minutes.',
})

const initDataSchema = z.object({ initData: z.string().min(1).max(4096) })
const linkSchema = initDataSchema.extend({ code: z.string().min(1).max(16) })
const messageSchema = z.object({ text: z.string().trim().min(1).max(2000) })
const resolveSchema = z.object({
  messageId: z.string().uuid(),
  toolUseId: z.string().min(1).max(128),
  decision: z.enum(['confirm', 'reject']),
})

async function parseBody<T extends z.ZodType>(
  c: { req: { json: () => Promise<unknown> } },
  schema: T,
): Promise<z.output<T> | null> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return null
  }
  const result = schema.safeParse(body)
  return result.success ? result.data : null
}

// Tells the Mini App whether there is anything to open before it asks for a
// session, so a deployment without a bot token or an API key shows one clear
// message instead of a failed sign-in.
assistantRouter.get('/config', (c) => {
  return c.json({ enabled: isTelegramEnabled() && isAIConfigured() })
})

assistantRouter.post('/session', sessionRateLimit, async (c) => {
  if (!isTelegramEnabled()) return c.json({ error: 'Telegram is not configured' }, 503)

  const body = await parseBody(c, initDataSchema)
  if (!body) return c.json({ error: 'Validation failed' }, 400)

  const result = await startSession(body.initData)
  switch (result.status) {
    case 'ok':
      return c.json({ linked: true, ...result.session })
    case 'unlinked':
      return c.json({ linked: false })
    default:
      // The initData did not verify against the bot token, so we cannot tell who
      // is calling. Deliberately not distinguished from a bad signature.
      return c.json({ error: 'Could not verify this Telegram session' }, 401)
  }
})

assistantRouter.post('/link', sessionRateLimit, async (c) => {
  if (!isTelegramEnabled()) return c.json({ error: 'Telegram is not configured' }, 503)

  const body = await parseBody(c, linkSchema)
  if (!body) return c.json({ error: 'Validation failed' }, 400)

  const result = await linkSession(body.initData, body.code)
  switch (result.status) {
    case 'ok':
      return c.json({ linked: true, ...result.session })
    case 'unverified':
      return c.json({ error: 'Could not verify this Telegram session' }, 401)
    case 'expired':
      return c.json({ error: 'That code has expired. Generate a fresh one in Settings.' }, 410)
    default:
      return c.json({ error: 'That code is not valid or has already been used.' }, 400)
  }
})

assistantRouter.get('/messages', authMiddleware, async (c) => {
  const view = await getTranscript(c.get('tenantId'), c.get('userId'))
  return c.json(view)
})

assistantRouter.post('/messages', authMiddleware, async (c) => {
  const body = await parseBody(c, messageSchema)
  if (!body) return c.json({ error: 'Validation failed' }, 400)

  try {
    const view = await sendMessage(c.get('tenantId'), c.get('userId'), body.text)
    return c.json(view)
  } catch (err) {
    if (err instanceof AssistantUnavailableError) return c.json({ error: err.message }, 503)
    throw err
  }
})

assistantRouter.post('/actions', authMiddleware, async (c) => {
  const body = await parseBody(c, resolveSchema)
  if (!body) return c.json({ error: 'Validation failed' }, 400)

  try {
    const outcome = await resolveAction(c.get('tenantId'), c.get('userId'), body)
    switch (outcome.status) {
      case 'ok':
        return c.json(outcome.view)
      case 'already_resolved':
        return c.json({ error: 'That action has already been answered.' }, 409)
      default:
        return c.json({ error: 'No pending action found.' }, 404)
    }
  } catch (err) {
    if (err instanceof AssistantUnavailableError) return c.json({ error: err.message }, 503)
    throw err
  }
})

export default assistantRouter
