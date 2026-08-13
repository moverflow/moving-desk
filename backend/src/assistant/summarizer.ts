import type Anthropic from '@anthropic-ai/sdk'
import { ASSISTANT_MODEL, anthropic } from '../lib/anthropic.js'
import type { StoredMessage } from './context.js'
import { transcribeForSummary } from './context.js'

// The compaction half of the context strategy: turns the messages that have
// fallen out of the verbatim window into one paragraph the next turn carries
// instead. Kept apart from context.ts so the boundary arithmetic there stays
// pure and testable without an API key.

const MAX_SUMMARY_TOKENS = 600

const SUMMARY_SYSTEM = `You compress a chat between a moving-company dispatcher and their assistant into notes the assistant will read to remember what happened.

Keep: decisions made, jobs and invoices actually created or changed (with ids and dates), client names and phone numbers, preferences the user stated, and anything left unfinished.
Drop: pleasantries, restatements, and data the assistant merely looked up and reported — it can look that up again.

Write one dense paragraph in plain past tense. No headings, no bullets, no preamble. If two versions of a fact appear, keep the later one.`

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
}

// Returns the new running summary, or null if there was nothing worth writing.
// `previous` is folded in rather than prepended, so the summary stays one
// paragraph however many times a long conversation is compacted.
export async function summarizeHistory(
  messages: readonly StoredMessage[],
  previous: string | null,
): Promise<string | null> {
  const transcript = transcribeForSummary([...messages])
  if (!transcript) return previous

  const prompt = previous
    ? `Notes so far:\n${previous}\n\nNewly dropped messages:\n${transcript}\n\nRewrite the notes to cover both.`
    : `Messages to compress:\n${transcript}`

  const response = await anthropic.messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: MAX_SUMMARY_TOKENS,
    // Compression, not reasoning — the cheapest setting is the right one, and it
    // keeps the user's next reply from waiting on a summarization.
    output_config: { effort: 'low' },
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const summary = extractText(response)
  return summary.length > 0 ? summary : previous
}
