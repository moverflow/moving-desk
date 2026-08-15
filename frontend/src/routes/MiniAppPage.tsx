import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import { useAssistantLink, useAssistantSession } from '@/hooks/useAssistant'
import ChatView from '@/features/assistant/ChatView'
import LinkingPanel from '@/features/assistant/LinkingPanel'
import { applyTelegramTheme, loadTelegramWebApp } from '@/lib/telegramWebApp'

// The Telegram Mini App entry point, opened from the bot's menu button or its
// /assistant command. It runs inside Telegram's WebView, which is where the
// signed initData needed to authenticate comes from.

type Stage =
  | { name: 'starting' }
  | { name: 'outside-telegram' }
  | { name: 'unverified' }
  | { name: 'linking' }
  | { name: 'chat'; company: string }

function Centered({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-[var(--tg-hint)]">{body}</p>
    </div>
  )
}

export default function MiniAppPage(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ name: 'starting' })
  const [initData, setInitData] = useState('')
  const session = useAssistantSession()
  const link = useAssistantLink()

  // Runs once: pull in the Telegram bridge, adopt its theme, then trade its
  // initData for a MovingDesk token.
  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      const webApp = await loadTelegramWebApp()
      if (cancelled) return

      applyTelegramTheme(webApp)

      if (!webApp?.initData) {
        setStage({ name: 'outside-telegram' })
        return
      }

      webApp.ready()
      webApp.expand()
      setInitData(webApp.initData)

      try {
        const result = await session.mutateAsync(webApp.initData)
        if (cancelled) return
        setStage(result.linked ? { name: 'chat', company: result.company } : { name: 'linking' })
      } catch {
        if (!cancelled) setStage({ name: 'unverified' })
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
    // Deliberately once per mount: re-running would start a second session
    // exchange, and the mutation object is a new reference on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitCode(code: string): Promise<void> {
    const result = await link.mutateAsync({ initData, code })
    if (result.linked) setStage({ name: 'chat', company: result.company })
  }

  const linkError =
    link.error instanceof ApiError ? link.error.message : link.error ? 'Could not connect.' : null

  return (
    <main className="h-screen bg-[var(--tg-bg)] text-[var(--tg-text)]">
      {stage.name === 'starting' && <Centered title="Opening assistant…" body="One moment." />}

      {stage.name === 'outside-telegram' && (
        <Centered
          title="Open this from Telegram"
          body="The assistant runs inside the MovingDesk bot. Send /assistant to the bot, or use the menu button beside the message box."
        />
      )}

      {stage.name === 'unverified' && (
        <Centered
          title="Could not verify this session"
          body="Close the assistant and open it again from the bot. If it keeps failing, the integration may not be configured on this deployment."
        />
      )}

      {stage.name === 'linking' && (
        <LinkingPanel
          onSubmit={(code) => void submitCode(code)}
          pending={link.isPending}
          error={linkError}
        />
      )}

      {stage.name === 'chat' && <ChatView company={stage.company} />}
    </main>
  )
}
