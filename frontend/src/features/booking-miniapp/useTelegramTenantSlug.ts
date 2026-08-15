import { useEffect, useState } from 'react'
import { applyTelegramViewport, loadTelegramWebApp } from '@/lib/telegramWebApp'
import { resolveTenantSlug } from './startParam'

// null while the Telegram bridge is still loading, '' once it has settled
// without yielding a slug. The two must stay distinct: collapsing them would
// flash the "no company" state before start_param has arrived.
export function useTelegramTenantSlug(): string | null {
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let releaseViewport = (): void => {}

    async function boot(): Promise<void> {
      const webApp = await loadTelegramWebApp()
      if (cancelled) return

      webApp?.ready()
      webApp?.expand()
      // After expand(), so the first measurement is of the size the form will
      // actually occupy. Keeps the Book button clear of Telegram's chrome.
      releaseViewport = applyTelegramViewport(webApp)
      setSlug(resolveTenantSlug(webApp, window.location) ?? '')
    }

    void boot()
    return () => {
      cancelled = true
      releaseViewport()
    }
  }, [])

  return slug
}
