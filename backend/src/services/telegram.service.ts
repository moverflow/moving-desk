import { randomInt } from 'node:crypto'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { telegramLinkCodes, users } from '../db/schema.js'
import { isTelegramEnabled, telegramDeepLink } from '../lib/telegram.js'
import { env } from '../lib/env.js'
import { getPublicTenant } from './booking.service.js'

// No 0/O/1/I: the owner reads this off one screen and types it into another.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

// Long enough to walk from the browser to the Telegram app, short enough that a
// code shoulder-surfed off a screen is worthless by the time it is used.
const CODE_TTL_MINUTES = 15

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return code
}

export interface TelegramStatus {
  enabled: boolean
  connected: boolean
  botUsername: string
}

export async function getTelegramStatus(
  tenantId: string,
  userId: string,
): Promise<TelegramStatus> {
  const [user] = await db
    .select({ chatId: users.telegram_chat_id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenant_id, tenantId)))
    .limit(1)

  return {
    enabled: isTelegramEnabled(),
    connected: Boolean(user?.chatId),
    botUsername: env.TELEGRAM_BOT_USERNAME,
  }
}

export interface LinkCodeResult {
  code: string
  deepLink: string
  expiresAt: Date
}

export async function createLinkCode(tenantId: string, userId: string): Promise<LinkCodeResult> {
  // Only the newest code should work — otherwise every code the owner ever
  // generated stays live until its own expiry.
  await db
    .update(telegramLinkCodes)
    .set({ used_at: new Date() })
    .where(
      and(
        eq(telegramLinkCodes.tenant_id, tenantId),
        eq(telegramLinkCodes.user_id, userId),
        isNull(telegramLinkCodes.used_at),
      ),
    )

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)
  const code = generateCode()

  await db.insert(telegramLinkCodes).values({
    tenant_id: tenantId,
    user_id: userId,
    code,
    expires_at: expiresAt,
  })

  return { code, deepLink: telegramDeepLink(code), expiresAt }
}

export type LinkResult =
  | { status: 'linked'; name: string }
  | { status: 'invalid' }
  | { status: 'expired' }

// Called from the bot's /start handler, where the only thing we know about the
// caller is the chat they wrote from — the code is what proves which account
// that chat belongs to. The lookup is therefore by code alone, with no tenant
// to scope it to yet (same shape as findInviteByToken); the tenant comes OUT of
// the matched row and scopes every write that follows.
export async function consumeLinkCode(code: string, chatId: string): Promise<LinkResult> {
  const [row] = await db
    .select({
      id: telegramLinkCodes.id,
      tenantId: telegramLinkCodes.tenant_id,
      userId: telegramLinkCodes.user_id,
      expiresAt: telegramLinkCodes.expires_at,
    })
    .from(telegramLinkCodes)
    .where(
      and(eq(telegramLinkCodes.code, code.toUpperCase()), isNull(telegramLinkCodes.used_at)),
    )
    .limit(1)

  if (!row) return { status: 'invalid' }
  if (row.expiresAt.getTime() < Date.now()) return { status: 'expired' }

  const [user] = await db
    .update(users)
    .set({ telegram_chat_id: chatId })
    .where(
      and(eq(users.id, row.userId), eq(users.tenant_id, row.tenantId), isNull(users.deleted_at)),
    )
    .returning({ name: users.name })

  // The code outlived the account it points at (removed user). Burn it anyway
  // so it cannot be retried.
  await db
    .update(telegramLinkCodes)
    .set({ used_at: new Date() })
    .where(and(eq(telegramLinkCodes.tenant_id, row.tenantId), eq(telegramLinkCodes.id, row.id)))

  if (!user) return { status: 'invalid' }
  return { status: 'linked', name: user.name }
}

const START_HELP =
  'Open MovingDesk → Settings → Integrations, generate a connect code, then send it here as /start YOURCODE.'

// The reply text for /start, kept out of the route so the linking rules can be
// tested without an HTTP request or a live bot.
export async function handleStartCommand(payload: string, chatId: string): Promise<string> {
  const code = payload.trim()
  if (!code) return `👋 Welcome to MovingDesk.\n\n${START_HELP}`

  const result = await consumeLinkCode(code, chatId)
  switch (result.status) {
    case 'linked':
      return `✅ Connected. Hi ${result.name} — new leads, signed contracts and paid invoices will show up here.`
    case 'expired':
      return `⌛ That code has expired. Codes last ${CODE_TTL_MINUTES} minutes — generate a fresh one in Settings → Integrations.`
    default:
      return `❌ That code is not valid or has already been used.\n\n${START_HELP}`
  }
}

// `/start book_<slug>` is the client-facing entry point: a mover shares it, and
// whoever taps it gets that company's booking form. It shares the /start
// payload with owner linking, so the prefix is what tells the two apart — a
// connect code can never contain an underscore (see CODE_ALPHABET).
const BOOKING_PREFIX = 'book_'

export type StartCommandReply =
  | { kind: 'text'; text: string }
  | { kind: 'booking'; text: string; slug: string; companyName: string }

// Deliberately routed through getPublicTenant rather than a lookup of its own:
// the booking_enabled gate and the slug resolution stay in one place, so this
// channel cannot drift from /book/:slug.
export async function resolveStartCommand(
  payload: string,
  chatId: string,
): Promise<StartCommandReply> {
  const trimmed = payload.trim()
  if (!trimmed.startsWith(BOOKING_PREFIX)) {
    return { kind: 'text', text: await handleStartCommand(trimmed, chatId) }
  }

  const slug = trimmed.slice(BOOKING_PREFIX.length)
  const tenant = slug ? await getPublicTenant(slug) : null
  if (!tenant) {
    return {
      kind: 'text',
      text: '🚚 This booking link is not valid, or the company is not taking online bookings right now.',
    }
  }

  return {
    kind: 'booking',
    text: `🚚 Book your move with ${tenant.name}. Tap below to open the booking form.`,
    slug: tenant.slug,
    companyName: tenant.name,
  }
}

export async function unlinkTelegram(tenantId: string, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ telegram_chat_id: null })
    .where(and(eq(users.id, userId), eq(users.tenant_id, tenantId)))
}

// Every linked, still-active user in the tenant. Deduplicated because one
// Telegram account linked to two accounts in the same company should not get
// the same notification twice.
export async function listTenantChatIds(tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ chatId: users.telegram_chat_id })
    .from(users)
    .where(
      and(
        eq(users.tenant_id, tenantId),
        isNotNull(users.telegram_chat_id),
        isNull(users.deleted_at),
      ),
    )

  const chatIds = rows.map((row) => row.chatId).filter((id): id is string => Boolean(id))
  return [...new Set(chatIds)]
}
