import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { ApiError } from '@/lib/api'
import {
  useAssistantTranscript,
  useResolveAssistantAction,
  useSendAssistantMessage,
} from '@/hooks/useAssistant'
import Composer from './Composer'
import MessageBubble from './MessageBubble'
import PendingActionCard from './PendingActionCard'

const SUGGESTIONS = [
  'Which invoices are unpaid?',
  "What's on this week?",
  'Book a 2 bedroom move',
]

function Empty({ onPick }: { onPick: (text: string) => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-[var(--tg-hint)]">
        Ask about your jobs, invoices and clients — or tell me to book a move.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-full bg-[var(--tg-secondary-bg)] px-3 py-1.5 text-xs"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatView({ company }: { company: string }): JSX.Element {
  const transcript = useAssistantTranscript(true)
  const send = useSendAssistantMessage()
  const resolve = useResolveAssistantAction()
  const bottom = useRef<HTMLDivElement>(null)

  const messages = transcript.data?.messages ?? []
  const pendingAction = transcript.data?.pendingAction ?? null
  const busy = send.isPending || resolve.isPending

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pendingAction, busy])

  const failure = send.error ?? resolve.error
  const failureMessage =
    failure instanceof ApiError ? failure.message : failure ? 'Something went wrong.' : null

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-black/10 px-4 py-2.5">
        <h1 className="text-sm font-semibold">Assistant</h1>
        <p className="text-xs text-[var(--tg-hint)]">{company}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {transcript.isLoading && (
          <p className="py-10 text-center text-sm text-[var(--tg-hint)]">Loading…</p>
        )}

        {!transcript.isLoading && messages.length === 0 && (
          <Empty onPick={(text) => send.mutate(text)} />
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {pendingAction && (
          <PendingActionCard
            action={pendingAction}
            pending={resolve.isPending}
            onConfirm={() => resolve.mutate({ action: pendingAction, decision: 'confirm' })}
            onReject={() => resolve.mutate({ action: pendingAction, decision: 'reject' })}
          />
        )}

        {busy && <p className="px-1 text-xs text-[var(--tg-hint)]">Thinking…</p>}
        {failureMessage && <p className="px-1 text-xs text-red-600">{failureMessage}</p>}

        <div ref={bottom} />
      </div>

      <Composer
        onSend={(text) => send.mutate(text)}
        // A held write is a question the user has to answer first: letting them
        // type past it would leave the proposal stranded in the transcript.
        disabled={busy || pendingAction !== null}
        placeholder={pendingAction ? 'Answer above to continue' : 'Message the assistant'}
      />
    </div>
  )
}
