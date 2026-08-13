import { createHmac, timingSafeEqual } from 'node:crypto'

// Verification for the `initData` string a Telegram Mini App hands its backend.
//
// This proves WHICH TELEGRAM ACCOUNT is calling — nothing more. It is not an
// account login: the Telegram id it yields is then matched against
// users.telegram_chat_id, the link established by the notifications feature, and
// that link is what identifies the MovingDesk user. Without this check the whole
// Mini App API would accept a user id typed by hand.

// Telegram derives the signing key from the bot token under this fixed label.
const KEY_LABEL = 'WebAppData'

// initData is signed once when the Mini App opens and never refreshed, so this
// bounds how long a copied payload stays usable. Long enough for a dispatcher to
// leave the chat open through a job.
const MAX_AGE_SECONDS = 24 * 60 * 60

export interface TelegramInitData {
  telegramUserId: string
  firstName: string | null
  username: string | null
}

export type InitDataResult =
  | { ok: true; data: TelegramInitData }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

function secretKey(botToken: string): Buffer {
  return createHmac('sha256', KEY_LABEL).update(botToken).digest()
}

// Every field except `hash`, sorted by key, joined as `key=value` with newlines —
// exactly the string Telegram signed.
function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

function parseUser(raw: string | null): TelegramInitData | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const user = parsed as { id?: unknown; first_name?: unknown; username?: unknown }

  // Telegram ids already exceed the safe integer range for some chat types, so
  // the id is carried as a string here and stored as one — same as
  // users.telegram_chat_id.
  if (typeof user.id !== 'number' || !Number.isInteger(user.id)) return null

  return {
    telegramUserId: String(user.id),
    firstName: typeof user.first_name === 'string' ? user.first_name : null,
    username: typeof user.username === 'string' ? user.username : null,
  }
}

export function verifyInitData(
  initData: string,
  botToken: string,
  now: Date = new Date(),
): InitDataResult {
  if (!initData || !botToken) return { ok: false, reason: 'malformed' }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'malformed' }

  const expected = createHmac('sha256', secretKey(botToken))
    .update(dataCheckString(params))
    .digest('hex')

  if (!hexEqual(hash, expected)) return { ok: false, reason: 'bad_signature' }

  // Only checked after the signature: auth_date is attacker-controlled until the
  // HMAC has been verified, so an "expired" answer before that would be
  // meaningless.
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'malformed' }
  if (now.getTime() / 1000 - authDate > MAX_AGE_SECONDS) return { ok: false, reason: 'expired' }

  const user = parseUser(params.get('user'))
  if (!user) return { ok: false, reason: 'malformed' }

  return { ok: true, data: user }
}
