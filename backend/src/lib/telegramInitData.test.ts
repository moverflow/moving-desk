import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyInitData } from './telegramInitData.js'

const BOT_TOKEN = '123456:AAEtEST-tOkEn_ForTests'
const NOW = new Date('2026-08-13T12:00:00Z')

// Builds a genuinely signed initData string the way Telegram does, so the tests
// exercise the real HMAC rather than a stub.
function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  const params = new URLSearchParams(fields)
  params.set('hash', hash)
  return params.toString()
}

function validFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    auth_date: String(Math.floor(NOW.getTime() / 1000) - 60),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: 987654321, first_name: 'Yuriy', username: 'ypuris' }),
    ...overrides,
  }
}

describe('verifyInitData', () => {
  it('accepts a correctly signed payload and returns the Telegram identity', () => {
    const result = verifyInitData(sign(validFields()), BOT_TOKEN, NOW)

    expect(result).toEqual({
      ok: true,
      data: { telegramUserId: '987654321', firstName: 'Yuriy', username: 'ypuris' },
    })
  })

  // The id is carried as a string because Telegram ids for some chat types are
  // already past what a JS number holds exactly.
  it('carries the id as a string', () => {
    const result = verifyInitData(
      sign(validFields({ user: JSON.stringify({ id: 7123456789, first_name: 'A' }) })),
      BOT_TOKEN,
      NOW,
    )

    expect(result.ok && result.data.telegramUserId).toBe('7123456789')
  })

  it('rejects a payload signed with a different bot token', () => {
    const forged = sign(validFields(), '999999:someone-elses-token')

    expect(verifyInitData(forged, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  // The whole point of the check: without it, anyone could name any Telegram id
  // and the link lookup would hand them that account.
  it('rejects a tampered user id even though every other field is intact', () => {
    const signed = sign(validFields())
    const params = new URLSearchParams(signed)
    params.set('user', JSON.stringify({ id: 111, first_name: 'Attacker' }))

    expect(verifyInitData(params.toString(), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('rejects a payload with no hash', () => {
    const params = new URLSearchParams(sign(validFields()))
    params.delete('hash')

    expect(verifyInitData(params.toString(), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('rejects a hash that is not hex of the right length', () => {
    const params = new URLSearchParams(sign(validFields()))
    params.set('hash', 'nope')

    expect(verifyInitData(params.toString(), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('rejects a signed payload older than the maximum age', () => {
    const twoDaysAgo = String(Math.floor(NOW.getTime() / 1000) - 2 * 24 * 60 * 60)

    expect(verifyInitData(sign(validFields({ auth_date: twoDaysAgo })), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('accepts a payload just inside the maximum age', () => {
    const almostADayAgo = String(Math.floor(NOW.getTime() / 1000) - (24 * 60 * 60 - 60))

    const result = verifyInitData(sign(validFields({ auth_date: almostADayAgo })), BOT_TOKEN, NOW)

    expect(result.ok).toBe(true)
  })

  // auth_date is attacker-controlled until the HMAC verifies, so a forged
  // payload must never come back as merely "expired".
  it('reports a bad signature rather than expiry when both are wrong', () => {
    const stale = String(Math.floor(NOW.getTime() / 1000) - 2 * 24 * 60 * 60)
    const forged = sign(validFields({ auth_date: stale }), 'other-token')

    expect(verifyInitData(forged, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a signed payload with no auth_date', () => {
    const fields = validFields()
    delete fields.auth_date

    expect(verifyInitData(sign(fields), BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects a signed payload with no user object', () => {
    const fields = validFields()
    delete fields.user

    expect(verifyInitData(sign(fields), BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects a user object that is not JSON', () => {
    expect(verifyInitData(sign(validFields({ user: 'not json' })), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('rejects a user object whose id is not an integer', () => {
    expect(
      verifyInitData(sign(validFields({ user: JSON.stringify({ id: 'abc' }) })), BOT_TOKEN, NOW),
    ).toEqual({ ok: false, reason: 'malformed' })
  })

  it('treats a missing first_name or username as absent rather than failing', () => {
    const result = verifyInitData(
      sign(validFields({ user: JSON.stringify({ id: 42 }) })),
      BOT_TOKEN,
      NOW,
    )

    expect(result).toEqual({
      ok: true,
      data: { telegramUserId: '42', firstName: null, username: null },
    })
  })

  it('rejects empty input and a missing bot token', () => {
    expect(verifyInitData('', BOT_TOKEN, NOW)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyInitData(sign(validFields()), '', NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('verifies regardless of parameter order in the query string', () => {
    const signed = sign(validFields())
    const params = new URLSearchParams(signed)
    const reversed = new URLSearchParams()
    for (const [key, value] of [...params.entries()].reverse()) reversed.append(key, value)

    expect(verifyInitData(reversed.toString(), BOT_TOKEN, NOW).ok).toBe(true)
  })
})
