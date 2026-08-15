import type { JSX } from 'react'
import { useState } from 'react'
import { Link2 } from 'lucide-react'

interface LinkingPanelProps {
  onSubmit: (code: string) => void
  pending: boolean
  error: string | null
}

// The same connect code as Settings → Integrations, entered here instead of sent
// to the bot as /start. Telegram has told us which account is calling; the code
// is what says which MovingDesk account it belongs to.
export default function LinkingPanel({ onSubmit, pending, error }: LinkingPanelProps): JSX.Element {
  const [code, setCode] = useState('')
  const canSubmit = code.trim().length >= 4 && !pending

  return (
    <div className="flex min-h-full flex-col justify-center p-6">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tg-secondary-bg)]">
        <Link2 className="h-5 w-5" aria-hidden />
      </span>

      <h1 className="mt-4 text-center text-lg font-semibold">Connect your account</h1>
      <p className="mt-2 text-center text-sm text-[var(--tg-hint)]">
        Open MovingDesk in your browser, go to Settings → Integrations, and generate a connect
        code. Codes last 15 minutes and work once.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit(code)
        }}
        className="mt-6 space-y-3"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 16))}
          placeholder="ABCD2345"
          aria-label="Connect code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full rounded-lg border border-black/15 bg-[var(--tg-bg)] px-3 py-2.5 text-center font-mono text-lg tracking-[0.25em] text-[var(--tg-text)] outline-none placeholder:tracking-[0.25em] placeholder:text-[var(--tg-hint)]"
        />

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-[var(--tg-button)] px-3 py-2.5 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-50"
        >
          {pending ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  )
}
