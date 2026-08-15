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

export interface TelegramWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  themeParams: TelegramThemeParams
  ready: () => void
  expand: () => void
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

// Reset for tests, which load the module once but need a clean bridge per case.
export function resetTelegramWebAppLoader(): void {
  loader = null
}
