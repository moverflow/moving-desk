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

// Where the Mini App lives. A route in the existing frontend, so it ships with
// the same deploy as the rest of the app.
export function miniAppUrl(): string {
  return `${env.FRONTEND_URL}/assistant`
}

// The client-facing booking Mini App. The slug rides in the query string for
// the bot-button route (`/start book_<slug>`); when the same page is opened
// through the Direct Link below, Telegram supplies the slug as start_param
// instead and the page reads it from there.
export function bookingMiniAppUrl(slug: string): string {
  return `${env.FRONTEND_URL}/book-app?tenant=${encodeURIComponent(slug)}`
}

// The short name this Mini App is registered under in BotFather (/newapp).
// Changing it here means re-registering there, and vice versa. Mirrored in the
// frontend's BookingTab, which builds the same link for the owner to copy.
export const BOOKING_APP_SHORT_NAME = 'book'

// The link an owner shares with clients. A named Direct Link rather than the
// bot's Main Mini App: the Main slot also backs the "Open App" button on the
// bot's public profile, which carries no start_param and would drop a visitor
// on the booking form's "no company in this link" state. A named app has no
// such second role, and leaves the Main slot free for the assistant later.
export function bookingDeepLink(slug: string): string {
  const bot = env.TELEGRAM_BOT_USERNAME
  return `https://t.me/${bot}/${BOOKING_APP_SHORT_NAME}?startapp=${encodeURIComponent(slug)}`
}

// Same page, opened in a browser. Used when Telegram cannot be handed a
// web_app button because the frontend is not on https.
export function webBookingUrl(slug: string): string {
  return `${env.FRONTEND_URL}/book/${slug}`
}

// Telegram only accepts an https URL for a web_app button, so a local frontend
// cannot be registered as one. Checked here rather than at the call sites so the
// bot's menu button and its /assistant reply agree on when it is available.
export function isMiniAppAvailable(): boolean {
  return isTelegramEnabled() && miniAppUrl().startsWith('https://')
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

// Puts "Open Assistant" in the bot's chat menu — the button beside the message
// box, which is how a Mini App is normally launched. Registered on every boot
// alongside the webhook so it follows the current deployment's URL. A failure
// here costs the menu entry and nothing else; the /assistant command still works.
export async function registerTelegramMenuButton(): Promise<void> {
  const instance = getBot()
  if (!instance) return

  if (!isMiniAppAvailable()) {
    logger.info(
      { url: miniAppUrl() },
      'Skipping Telegram menu button: Mini App needs an https FRONTEND_URL',
    )
    return
  }

  try {
    await instance.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Assistant',
        web_app: { url: miniAppUrl() },
      },
    })
    logger.info({ url: miniAppUrl() }, 'Telegram Mini App menu button registered')
  } catch (err) {
    logger.error({ err }, 'Failed to register Telegram menu button')
  }
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
