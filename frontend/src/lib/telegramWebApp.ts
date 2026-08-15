// Access to the Telegram Web App bridge, which is only present when the page is
// open inside Telegram's WebView.
//
// The SDK is loaded on demand rather than from index.html: only the Mini App
// route needs it, and every other page in the app would otherwise pay for a
// third-party script on first paint.

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'

export interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

export interface TelegramInitDataUnsafe {
  // Present when the Mini App was opened through a deep link carrying a
  // parameter — `t.me/<bot>?startapp=<value>`, or the payload of `/start`.
  start_param?: string
}

export interface TelegramInsets {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

// Only the events this app subscribes to. Telegram defines more.
export type TelegramEvent = 'viewportChanged' | 'safeAreaChanged' | 'contentSafeAreaChanged'

export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: TelegramInitDataUnsafe
  colorScheme: 'light' | 'dark'
  themeParams: TelegramThemeParams
  ready: () => void
  expand: () => void
  // Everything below arrived in Bot API 6.x–8.0 and is absent in older
  // Telegram clients, so each one is optional and separately guarded.
  viewportHeight?: number
  viewportStableHeight?: number
  // The device's own unusable edges — notch, home indicator.
  safeAreaInset?: TelegramInsets
  // Telegram's own chrome, measured inside safeAreaInset rather than from the
  // window edge, which is why the two are added together below.
  contentSafeAreaInset?: TelegramInsets
  onEvent?: (event: TelegramEvent, handler: () => void) => void
  offEvent?: (event: TelegramEvent, handler: () => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

let loader: Promise<TelegramWebApp | null> | null = null

function injectSdk(): Promise<TelegramWebApp | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Telegram?.WebApp ?? null))
      existing.addEventListener('error', () => resolve(null))
      return
    }

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => resolve(window.Telegram?.WebApp ?? null)
    // Opened outside Telegram, or the script is blocked. Either way there is no
    // bridge, and the page says so rather than hanging.
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp)
  loader ??= injectSdk()
  return loader
}

// Telegram's own palette, so the Mini App matches whatever theme the user runs
// Telegram in. Applied as CSS variables the stylesheet already references, with
// fallbacks for a page opened outside Telegram.
export function applyTelegramTheme(webApp: TelegramWebApp | null): void {
  const theme = webApp?.themeParams ?? {}
  const root = document.documentElement

  const vars: Record<string, string | undefined> = {
    '--tg-bg': theme.bg_color,
    '--tg-text': theme.text_color,
    '--tg-hint': theme.hint_color,
    '--tg-link': theme.link_color,
    '--tg-button': theme.button_color,
    '--tg-button-text': theme.button_text_color,
    '--tg-secondary-bg': theme.secondary_bg_color,
  }

  for (const [name, value] of Object.entries(vars)) {
    if (value) root.style.setProperty(name, value)
  }
}

// How tall the Mini App actually is, and how much of its bottom edge is not
// really usable. 100vh is the wrong answer to the first question inside
// Telegram: the WebView is laid out full-screen, but Telegram draws its own
// chrome over the bottom of it and the device adds a home indicator under that.
// Trusting 100vh puts the composer underneath both.
//
// Written as CSS variables rather than React state so the values are available
// to plain classNames, and so a re-render is not needed to follow a resize.
const HEIGHT_VAR = '--tg-app-height'
const SAFE_BOTTOM_VAR = '--tg-safe-bottom'

function bottomInset(webApp: TelegramWebApp): number {
  // Additive: contentSafeAreaInset is measured inside safeAreaInset, so the
  // distance from the window edge to usable content is the sum of the two.
  return (webApp.safeAreaInset?.bottom ?? 0) + (webApp.contentSafeAreaInset?.bottom ?? 0)
}

function writeViewportVars(webApp: TelegramWebApp): void {
  const root = document.documentElement

  // The stable height deliberately ignores the on-screen keyboard, so the shell
  // does not resize under the user mid-sentence. The keyboard is the browser's
  // problem — it scrolls the focused input into view on its own.
  const height = webApp.viewportStableHeight ?? webApp.viewportHeight
  if (height && height > 0) root.style.setProperty(HEIGHT_VAR, `${height}px`)

  const inset = bottomInset(webApp)
  // Left alone at 0 so the CSS fallback (env(safe-area-inset-bottom)) keeps
  // whatever the browser worked out for itself on an older Telegram client.
  if (inset > 0) root.style.setProperty(SAFE_BOTTOM_VAR, `${inset}px`)
}

// Returns a cleanup that removes the listeners, for a caller unmounting the
// Mini App. Safe to call with no bridge and on a Telegram client too old to
// report any of this — it just leaves the CSS defaults in place.
export function applyTelegramViewport(webApp: TelegramWebApp | null): () => void {
  if (!webApp) return () => {}

  writeViewportVars(webApp)

  const handler = (): void => writeViewportVars(webApp)
  const events: TelegramEvent[] = ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']

  const { onEvent, offEvent } = webApp
  if (!onEvent) return () => {}

  for (const event of events) onEvent.call(webApp, event, handler)

  return () => {
    if (!offEvent) return
    for (const event of events) offEvent.call(webApp, event, handler)
  }
}

// Reset for tests, which load the module once but need a clean bridge per case.
export function resetTelegramWebAppLoader(): void {
  loader = null
}
