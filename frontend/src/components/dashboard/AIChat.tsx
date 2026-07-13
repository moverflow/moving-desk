import type { JSX, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { useAIChat } from '@/hooks/useAIInsights'

const DAILY_LIMIT = 5

const SUGGESTED = [
  'Why did my revenue drop last week?',
  'Which crew is most profitable?',
  'How can I improve client retention?',
  'Why are clients cancelling?',
  "What's my best performing month?",
]

const LIMIT_MESSAGE =
  "You've used all 5 AI questions for today. Questions reset at midnight. Upgrade to Pro for unlimited questions."

interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  at: number
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function AIChat(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [remaining, setRemaining] = useState(DAILY_LIMIT)
  const chat = useAIChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function append(role: ChatMessage['role'], text: string): void {
    setMessages((prev) => [...prev, { id: prev.length + Date.now(), role, text, at: Date.now() }])
  }

  function send(): void {
    const text = input.trim()
    if (!text || chat.isPending || remaining <= 0) return
    append('user', text)
    setInput('')
    chat.mutate(text, {
      onSuccess: (res) => {
        append('ai', res.reply)
        setRemaining(res.questionsRemaining)
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 429) {
          setRemaining(0)
          append('ai', LIMIT_MESSAGE)
        } else {
          append('ai', 'Sorry, something went wrong. Please try again.')
        }
      },
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const disabled = remaining <= 0 || chat.isPending

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-gray-900">Ask AI about your business</p>

      <div
        ref={scrollRef}
        className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        style={{ maxHeight: 400, minHeight: 160 }}
      >
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">
            <p className="mb-2">Try asking:</p>
            <div className="flex flex-col items-start gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setInput(q)}
                  className="text-left text-[#1d9e75] hover:underline"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-[#1d9e75] text-white'
                  : 'border border-gray-200 bg-white text-gray-800',
              )}
            >
              {m.text}
            </div>
            <span className="mt-1 text-[11px] text-gray-400">{formatTime(m.at)}</span>
          </div>
        ))}

        {chat.isPending && <div className="text-sm text-gray-400">AI is thinking…</div>}
      </div>

      {remaining <= 0 && (
        <p className="text-xs text-gray-500">{LIMIT_MESSAGE}</p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about your business..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1d9e75] disabled:bg-gray-50 disabled:text-gray-400"
        />
        <span className="shrink-0 text-[11px] text-gray-500">{remaining} left today</span>
        <button
          type="button"
          onClick={send}
          disabled={disabled || !input.trim()}
          className="shrink-0 rounded-md bg-[#1d9e75] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  )
}
