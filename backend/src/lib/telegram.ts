import { Bot } from 'grammy'
import { env } from './env.js'
import { logger } from './logger.js'

// One shared bot serves every tenant — tenants are told apart by which user a
// chat_id is linked to, not by which bot they talk to.
export function isTelegramEnabled(): boolean {
  return env.TELEGRAM_BOT_TOKEN.length > 0
}

function missingTelegramVars(): string[] {
  const missing: string[] = []
  if (!env.TELEGRAM_BOT_USERNAME) missing.push('TELEGRAM_BOT_USERNAME')
  if (!env.TELEGRAM_WEBHOOK_SECRET) missing.push('TELEGRAM_WEBHOOK_SECRET')
  return missing
}

// A token with no webhook secret is the dangerous half-configured state: the
// update endpoint would accept anything that finds the URL, and a forged
// /start could link an attacker's chat to someone else's account. Caught at
// startup rather than on the first update.
export function assertTelegramConfigured(): void {
  if (!isTelegramEnabled()) return

  const missing = missingTelegramVars()
  if (missing.length === 0) return

  throw new Error(
    `Telegram bot is not fully configured. Missing env vars: ${missing.join(', ')}. ` +
      'Refusing to start: without a webhook secret any caller who guesses the webhook ' +
      'URL could forge updates, and without the bot username the linking deep link ' +
      'cannot be built. Unset TELEGRAM_BOT_TOKEN to disable the integration instead.',
  )
}

let bot: Bot | null = null

// Lazy so importing this module stays free when the integration is off, and so
// tests can import the helpers without a token present.
export function getBot(): Bot | null {
  if (!isTelegramEnabled()) return null
  if (!bot) bot = new Bot(env.TELEGRAM_BOT_TOKEN)
  return bot
}

export function telegramDeepLink(code: string): string {
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`
}

// Fire-and-forget, exactly like the Resend sends: a Telegram outage must never
// turn into a failed booking or a Stripe webhook retry. Never rejects.
export function sendTelegramMessage(chatId: string, text: string): void {
  const instance = getBot()
  if (!instance) return

  instance.api
    .sendMessage(chatId, text, { link_preview_options: { is_disabled: true } })
    .catch((err: unknown) => {
      logger.error({ err, chatId }, 'Failed to send Telegram message')
    })
}

// Telegram delivers updates to whatever URL was last registered, so this runs
// on every boot to keep it pointed at the current deployment. Awaited by the
// caller only to log the outcome — a failure here leaves sending intact.
export async function registerTelegramWebhook(): Promise<void> {
  const instance = getBot()
  if (!instance) {
    logger.info('Telegram disabled (TELEGRAM_BOT_TOKEN not set)')
    return
  }

  const url = `${env.BACKEND_URL}/telegram/webhook`
  try {
    await instance.api.setWebhook(url, {
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    })
    logger.info({ url }, 'Telegram webhook registered')
  } catch (err) {
    logger.error({ err, url }, 'Failed to register Telegram webhook')
  }
}
