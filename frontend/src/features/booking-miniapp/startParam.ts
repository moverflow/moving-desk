import type { TelegramWebApp } from '@/lib/telegramWebApp'

// Which company's booking form to show. The same page is reachable through
// three entry points, and each one hands the slug over differently:
//
//   1. `t.me/<bot>/book?startapp=<slug>` — Telegram opens the named Mini App
//      and puts the value in initDataUnsafe.start_param.
//   2. the same link, read off the URL Telegram loaded the WebView with
//      (`#tgWebAppStartParam=<slug>`) — the SDK's own source, used directly here
//      as a fallback for when the bridge is present but has not parsed yet.
//   3. `?tenant=<slug>` — the bot's `/start book_<slug>` reply, whose web_app
//      button points at a URL the backend built with the slug already in it.

// Slugs are generated as lowercase kebab-case (see generateSlug), and Telegram
// only carries A-Z a-z 0-9 _ - in a start param. Anything else reached this page
// by hand and is not a slug we would find anyway — rejecting it here keeps a
// junk value out of the API call and out of the query cache key.
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/

// The prefix the bot uses to tell a booking deep link apart from an owner
// connect code. Accepted here too, so one link shape works whether Telegram
// routes it through the bot or straight into the Mini App.
const BOOKING_PREFIX = 'book_'

function normalize(raw: string | undefined | null): string | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  const slug = value.startsWith(BOOKING_PREFIX) ? value.slice(BOOKING_PREFIX.length) : value
  return SLUG_PATTERN.test(slug) ? slug : null
}

export function resolveTenantSlug(
  webApp: TelegramWebApp | null,
  location: { search: string; hash: string },
): string | null {
  const fromBridge = normalize(webApp?.initDataUnsafe?.start_param)
  if (fromBridge) return fromBridge

  // Telegram appends its parameters to the fragment, but has also been observed
  // to use the query string; both are cheap to check.
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const search = new URLSearchParams(location.search)

  return (
    normalize(hash.get('tgWebAppStartParam')) ??
    normalize(search.get('tgWebAppStartParam')) ??
    normalize(search.get('tenant'))
  )
}
