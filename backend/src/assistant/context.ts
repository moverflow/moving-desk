// Context-window strategy for the assistant.
//
// Keeping the whole transcript forever is not an option: a dispatcher's chat runs
// for weeks, and every turn resends the entire history. The strategy here is
// "recent window verbatim, older history as a rolling summary":
//
//   1. The newest KEEP_RECENT messages are always replayed exactly as stored.
//   2. Once the verbatim tail grows past SUMMARIZE_ABOVE, the overflow is folded
//      into a single running summary (which itself includes the previous
//      summary, so nothing is lost twice) and stops being replayed.
//   3. The cut point is nudged so it never lands between a tool_use and its
//      tool_result — the Messages API rejects an orphaned tool_result, and a
//      naive count-based slice produces one roughly half the time.
//
// Everything in this file is pure so the boundary arithmetic can be tested
// without a database or an API key.

export interface StoredMessage {
  seq: number
  role: 'user' | 'assistant' | 'tool'
  content: unknown[]
}

// Enough for the assistant to follow a multi-step booking ("create it" → "which
// client?" → "the Smiths") without re-reading the summary.
export const KEEP_RECENT = 12

// Summarizing on every message would spend a model call per turn. Letting the
// tail reach twice the keep window means one summarization roughly every
// KEEP_RECENT messages instead.
export const SUMMARIZE_ABOVE = 24

export interface ContextPlan {
  // Replayed to the model verbatim, in order.
  keep: StoredMessage[]
  // Messages to fold into the summary. Empty when no summarization is due.
  toSummarize: StoredMessage[]
  // New value for conversations.summarized_through_seq once the summary is
  // written. Unchanged from the current watermark when toSummarize is empty.
  summarizedThroughSeq: number
}

function isToolResultMessage(message: StoredMessage): boolean {
  return message.role === 'tool'
}

// A tool_result must be preceded by the assistant turn that requested it, so the
// window may not start on one. Walk the boundary earlier until it starts on a
// user or assistant message.
function pullBoundaryBack(messages: StoredMessage[], start: number): number {
  let index = start
  while (index > 0 && isToolResultMessage(messages[index])) index--
  return index
}

// `messages` must be the conversation's messages above the current watermark,
// ordered by seq ascending.
export function planContextWindow(
  messages: StoredMessage[],
  summarizedThroughSeq: number,
): ContextPlan {
  if (messages.length <= SUMMARIZE_ABOVE) {
    return { keep: messages, toSummarize: [], summarizedThroughSeq }
  }

  const naiveStart = messages.length - KEEP_RECENT
  const start = pullBoundaryBack(messages, naiveStart)

  // The whole window turned out to be one long tool exchange, so there is no
  // safe cut inside it. Replay it intact rather than send an invalid transcript;
  // the next turn gets another chance once a plain user message lands.
  if (start === 0) {
    return { keep: messages, toSummarize: [], summarizedThroughSeq }
  }

  const toSummarize = messages.slice(0, start)
  return {
    keep: messages.slice(start),
    toSummarize,
    summarizedThroughSeq: toSummarize[toSummarize.length - 1].seq,
  }
}

// Flattens content blocks to the plain text a summarizer needs. Tool traffic is
// labelled rather than dumped: the argument JSON is noise once the action has
// happened, but the fact that it happened is not.
export function transcribeForSummary(messages: StoredMessage[]): string {
  const lines: string[] = []

  for (const message of messages) {
    const parts: string[] = []
    for (const block of message.content) {
      if (typeof block !== 'object' || block === null) continue
      const b = block as { type?: string; text?: string; name?: string; is_error?: boolean }

      if (b.type === 'text' && typeof b.text === 'string') {
        parts.push(b.text)
      } else if (b.type === 'tool_use' && b.name) {
        parts.push(`[called ${b.name}]`)
      } else if (b.type === 'tool_result') {
        parts.push(b.is_error ? '[tool failed]' : '[tool returned data]')
      }
    }

    if (parts.length === 0) continue
    const speaker = message.role === 'user' ? 'Dispatcher' : 'Assistant'
    lines.push(`${speaker}: ${parts.join(' ')}`)
  }

  return lines.join('\n')
}
