import type { JSX, KeyboardEvent } from 'react'
import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'

interface ComposerProps {
  onSend: (text: string) => void
  disabled: boolean
  placeholder: string
}

const MAX_LENGTH = 2000

export default function Composer({ onSend, disabled, placeholder }: ComposerProps): JSX.Element {
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0 && !disabled

  function send(): void {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }

  // Enter sends, Shift+Enter starts a new line — the convention in every chat
  // app a dispatcher already uses.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  // Bottom padding so the send button is not flush against the edge of the
  // screen. Mostly the static 1rem: --tg-safe-bottom is 0 unless the browser has
  // actually reserved space for a home indicator, so it tops the gap up on the
  // devices that need it rather than being the whole of it.
  return (
    <div className="flex items-end gap-2 border-t border-black/10 bg-[var(--tg-bg)] p-2 pb-[calc(1rem+var(--tg-safe-bottom))]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        aria-label="Message the assistant"
        // Disabled alongside the button, not just it: a box that accepts typing
        // and then silently drops it on Enter reads as the app being broken.
        disabled={disabled}
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl bg-[var(--tg-secondary-bg)] px-3 py-2 text-sm text-[var(--tg-text)] outline-none placeholder:text-[var(--tg-hint)] disabled:opacity-60"
      />
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        aria-label="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tg-button)] text-[var(--tg-button-text)] disabled:opacity-40"
      >
        <SendHorizontal className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
