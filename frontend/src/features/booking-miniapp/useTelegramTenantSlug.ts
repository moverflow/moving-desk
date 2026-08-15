import { useEffect, useState } from 'react'
import { loadTelegramWebApp } from '@/lib/telegramWebApp'
import { resolveTenantSlug } from './startParam'

// null while the Telegram bridge is still loading, '' once it has settled
// without yielding a slug. The two must stay distinct: collapsing them would
// flash the "no company" state before start_param has arrived.
export function useTelegramTenantSlug(): string | null {
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      const webApp = await loadTelegramWebApp()
      if (cancelled) return

      webApp?.ready()
      webApp?.expand()
      setSlug(resolveTenantSlug(webApp, window.location) ?? '')
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  return slug
}
