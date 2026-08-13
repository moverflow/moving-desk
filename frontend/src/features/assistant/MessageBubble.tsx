import type { JSX } from 'react'
import type { AssistantMessage } from '@/types'
import ToolResults from './ToolResults'

// Cards sit outside the bubble on assistant turns: they are full-width panels,
// and squeezing them into a chat bubble makes a job unreadable on a phone.
export default function MessageBubble({ message }: { message: AssistantMessage }): JSX.Element {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[var(--tg-button)] px-3 py-2 text-sm text-[var(--tg-button-text)]">
          {message.text}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {message.text && (
        <div className="flex justify-start">
          <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-[var(--tg-secondary-bg)] px-3 py-2 text-sm">
            {message.text}
          </p>
        </div>
      )}
      <ToolResults results={message.results} />
    </div>
  )
}
