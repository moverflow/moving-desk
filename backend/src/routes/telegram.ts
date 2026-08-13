import { Hono } from 'hono'
import { webhookCallback } from 'grammy'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { getBot, isTelegramEnabled } from '../lib/telegram.js'
import { authMiddleware, requireOwner } from '../middleware/auth.js'
import {
  createLinkCode,
  getTelegramStatus,
  handleStartCommand,
  unlinkTelegram,
} from '../services/telegram.service.js'
import type { AppVariables } from '../types/index.js'

const telegramRouter = new Hono<{ Variables: AppVariables }>()

telegramRouter.get('/', authMiddleware, requireOwner, async (c) => {
  const status = await getTelegramStatus(c.get('tenantId'), c.get('userId'))
  return c.json(status)
})

telegramRouter.post('/link-code', authMiddleware, requireOwner, async (c) => {
  if (!isTelegramEnabled()) {
    return c.json({ error: 'Telegram integration is not configured' }, 503)
  }

  const result = await createLinkCode(c.get('tenantId'), c.get('userId'))
  return c.json({
    code: result.code,
    deepLink: result.deepLink,
    expiresAt: result.expiresAt.toISOString(),
  })
})

telegramRouter.delete('/', authMiddleware, requireOwner, async (c) => {
  await unlinkTelegram(c.get('tenantId'), c.get('userId'))
  return c.json({ success: true })
})

const bot = getBot()

if (bot) {
  bot.command('start', async (ctx) => {
    const reply = await handleStartCommand(ctx.match, String(ctx.chat.id))
    await ctx.reply(reply, { link_preview_options: { is_disabled: true } })
  })

  // A thrown error inside a handler would otherwise bubble out of
  // webhookCallback as a 500, which Telegram answers by redelivering the same
  // update for hours.
  bot.catch((err) => {
    logger.error({ err: err.error, updateId: err.ctx.update.update_id }, 'Telegram update failed')
  })

  telegramRouter.post(
    '/webhook',
    webhookCallback(bot, 'hono', { secretToken: env.TELEGRAM_WEBHOOK_SECRET }),
  )
}

export default telegramRouter
