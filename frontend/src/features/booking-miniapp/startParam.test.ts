import { describe, expect, it } from 'vitest'
import { resolveTenantSlug } from './startParam'
import type { TelegramWebApp } from '@/lib/telegramWebApp'

function bridge(startParam?: string): TelegramWebApp {
  return {
    initData: 'user=%7B%7D&hash=abc',
    ...(startParam === undefined ? {} : { initDataUnsafe: { start_param: startParam } }),
    colorScheme: 'light',
    themeParams: {},
    ready: () => {},
    expand: () => {},
  }
}

const NO_URL = { search: '', hash: '' }

describe('resolveTenantSlug — start_param', () => {
  // AC: opening t.me/<bot>?startapp=<slug> scopes the form to that tenant.
  it('reads the slug Telegram passed as start_param', () => {
    expect(resolveTenantSlug(bridge('best-movers'), NO_URL)).toBe('best-movers')
  })

  it('accepts the book_ prefix the bot uses on the same value', () => {
    expect(resolveTenantSlug(bridge('book_best-movers'), NO_URL)).toBe('best-movers')
  })

  it('prefers the bridge over the URL when both carry a slug', () => {
    const url = { search: '?tenant=other-co', hash: '' }
    expect(resolveTenantSlug(bridge('best-movers'), url)).toBe('best-movers')
  })
})

describe('resolveTenantSlug — URL fallbacks', () => {
  it('reads tgWebAppStartParam from the fragment Telegram loads the WebView with', () => {
    const url = { search: '', hash: '#tgWebAppStartParam=best-movers&tgWebAppVersion=7.0' }
    expect(resolveTenantSlug(null, url)).toBe('best-movers')
  })

  it('reads tgWebAppStartParam from the query string', () => {
    expect(resolveTenantSlug(null, { search: '?tgWebAppStartParam=best-movers', hash: '' })).toBe(
      'best-movers',
    )
  })

  // How the bot's /start book_<slug> button arrives: the backend already put the
  // slug in the URL it handed Telegram.
  it('reads the tenant query param the bot button carries', () => {
    expect(resolveTenantSlug(null, { search: '?tenant=best-movers', hash: '' })).toBe('best-movers')
  })
})

describe('resolveTenantSlug — nothing usable', () => {
  it('returns null with no bridge and no URL parameters', () => {
    expect(resolveTenantSlug(null, NO_URL)).toBeNull()
  })

  it('returns null for an empty start_param', () => {
    expect(resolveTenantSlug(bridge(''), NO_URL)).toBeNull()
  })

  it('returns null for a prefix with no slug behind it', () => {
    expect(resolveTenantSlug(bridge('book_'), NO_URL)).toBeNull()
  })

  // Nothing downstream trusts this value — the API scopes by slug either way —
  // but a junk slug should not become a query key or an API call.
  it.each(['../admin', 'a b', 'slug!', 'x'.repeat(65)])('rejects %j', (value) => {
    expect(resolveTenantSlug(bridge(value), NO_URL)).toBeNull()
  })

  it('normalizes case, since slugs are stored lowercase', () => {
    expect(resolveTenantSlug(bridge('Best-Movers'), NO_URL)).toBe('best-movers')
  })
})
