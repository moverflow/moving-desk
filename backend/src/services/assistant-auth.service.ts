import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users } from '../db/schema.js'
import { env } from '../lib/env.js'
import { verifyInitData } from '../lib/telegramInitData.js'
import { signToken } from '../lib/jwt.js'
import type { Plan, UserRole } from '../types/index.js'
import { getAuthContext } from './auth.service.js'
import { consumeLinkCode } from './telegram.service.js'

// How a Mini App request becomes an authenticated MovingDesk session.
//
// Two independent facts are needed and neither substitutes for the other:
//   1. Telegram's signed initData proves which Telegram account is calling.
//   2. users.telegram_chat_id — the link the notifications feature already
//      established with a one-time code — says which MovingDesk account that
//      Telegram account belongs to.
//
// With both, the caller gets the app's ordinary JWT, so every assistant route
// runs behind the same authMiddleware as the rest of the API. There is no
// Telegram-only auth path and no second notion of a session.

export interface AssistantSession {
  token: string
  user: { id: string; name: string; role: string }
  company: string
}

export type SessionResult =
  | { status: 'ok'; session: AssistantSession }
  | { status: 'unverified' }
  | { status: 'unlinked'; telegramUserId: string }

// Looked up by Telegram id alone, with no tenant to scope it to yet — the same
// shape as consumeLinkCode and findInviteByToken. The verified Telegram identity
// is all we know about the caller at this point; the tenant comes OUT of the
// matched row and scopes every query that follows.
//
// One Telegram account could have been linked to two MovingDesk accounts (the
// column is not unique — see listTenantChatIds, which dedupes for the same
// reason). The oldest link wins, so the Mini App always opens the same account
// rather than flipping between them.
async function findLinkedUser(telegramUserId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegram_chat_id, telegramUserId), isNull(users.deleted_at)))
    .orderBy(asc(users.created_at))
    .limit(1)

  return rows[0]?.id ?? null
}

async function issueSession(userId: string): Promise<AssistantSession | null> {
  const auth = await getAuthContext(userId)
  if (!auth) return null

  const [row] = await db
    .select({ name: users.name, role: users.role, company: tenants.name })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenant_id))
    .where(and(eq(users.id, userId), eq(users.tenant_id, auth.tenantId)))
    .limit(1)

  if (!row) return null

  // Same cast as the /auth routes: getAuthContext reads role and plan back as
  // plain strings, and the column types are what constrain them.
  const token = await signToken({
    sub: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role as UserRole,
    plan: auth.plan as Plan,
    ...(auth.crewId ? { crewId: auth.crewId } : {}),
  })

  return {
    token,
    user: { id: auth.userId, name: row.name, role: row.role },
    company: row.company,
  }
}

export async function startSession(initData: string): Promise<SessionResult> {
  const verified = verifyInitData(initData, env.TELEGRAM_BOT_TOKEN)
  if (!verified.ok) return { status: 'unverified' }

  const userId = await findLinkedUser(verified.data.telegramUserId)
  if (!userId) return { status: 'unlinked', telegramUserId: verified.data.telegramUserId }

  const session = await issueSession(userId)
  // Verified Telegram account, a link pointing at it, but the account behind the
  // link is gone. Same answer as never having linked: the user connects again.
  if (!session) return { status: 'unlinked', telegramUserId: verified.data.telegramUserId }

  return { status: 'ok', session }
}

export type LinkResult =
  | { status: 'ok'; session: AssistantSession }
  | { status: 'unverified' }
  | { status: 'invalid' }
  | { status: 'expired' }

// The linking-code flow from the notifications feature, run from inside the Mini
// App instead of the bot's /start handler. Same codes, same single-use rules,
// same service call — the only difference is where the code was typed.
export async function linkSession(initData: string, code: string): Promise<LinkResult> {
  const verified = verifyInitData(initData, env.TELEGRAM_BOT_TOKEN)
  if (!verified.ok) return { status: 'unverified' }

  const linked = await consumeLinkCode(code, verified.data.telegramUserId)
  if (linked.status !== 'linked') return { status: linked.status }

  const userId = await findLinkedUser(verified.data.telegramUserId)
  if (!userId) return { status: 'invalid' }

  const session = await issueSession(userId)
  if (!session) return { status: 'invalid' }

  return { status: 'ok', session }
}
