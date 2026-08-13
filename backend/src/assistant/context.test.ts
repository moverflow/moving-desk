import { describe, expect, it } from 'vitest'
import {
  KEEP_RECENT,
  SUMMARIZE_ABOVE,
  planContextWindow,
  transcribeForSummary,
  type StoredMessage,
} from './context.js'

function text(seq: number, role: StoredMessage['role'], body: string): StoredMessage {
  return { seq, role, content: [{ type: 'text', text: body }] }
}

function toolUse(seq: number, name: string, id: string): StoredMessage {
  return { seq, role: 'assistant', content: [{ type: 'tool_use', id, name, input: {} }] }
}

function toolResult(seq: number, id: string, isError = false): StoredMessage {
  return {
    seq,
    role: 'tool',
    content: [
      { type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: '[]' }], is_error: isError },
    ],
  }
}

// Alternating user/assistant chatter, which never contains a tool pair and so is
// always safe to cut anywhere.
function chatter(count: number, startSeq = 1): StoredMessage[] {
  return Array.from({ length: count }, (_, i) =>
    text(startSeq + i, i % 2 === 0 ? 'user' : 'assistant', `message ${startSeq + i}`),
  )
}

describe('planContextWindow', () => {
  it('keeps everything and summarizes nothing below the threshold', () => {
    const messages = chatter(SUMMARIZE_ABOVE)

    const plan = planContextWindow(messages, 0)

    expect(plan.keep).toHaveLength(SUMMARIZE_ABOVE)
    expect(plan.toSummarize).toEqual([])
    expect(plan.summarizedThroughSeq).toBe(0)
  })

  it('summarizes the overflow and keeps the recent window once the threshold is passed', () => {
    const messages = chatter(SUMMARIZE_ABOVE + 1)

    const plan = planContextWindow(messages, 0)

    expect(plan.keep).toHaveLength(KEEP_RECENT)
    expect(plan.toSummarize).toHaveLength(SUMMARIZE_ABOVE + 1 - KEEP_RECENT)
    // Kept and summarized partition the input with no gap and no overlap.
    expect(plan.toSummarize.map((m) => m.seq)).toEqual(
      messages.slice(0, SUMMARIZE_ABOVE + 1 - KEEP_RECENT).map((m) => m.seq),
    )
    expect(plan.keep[0].seq).toBe(plan.toSummarize[plan.toSummarize.length - 1].seq + 1)
  })

  it('advances the watermark to the last summarized message', () => {
    const messages = chatter(30)

    const plan = planContextWindow(messages, 0)

    expect(plan.summarizedThroughSeq).toBe(plan.toSummarize[plan.toSummarize.length - 1].seq)
    expect(plan.keep.every((m) => m.seq > plan.summarizedThroughSeq)).toBe(true)
  })

  it('is a no-op when the whole window is already summarized away', () => {
    const plan = planContextWindow([], 42)

    expect(plan.keep).toEqual([])
    expect(plan.toSummarize).toEqual([])
    expect(plan.summarizedThroughSeq).toBe(42)
  })

  // The Messages API rejects a tool_result whose tool_use is missing, so the cut
  // must never land between the two. A plain count-based slice does exactly that
  // whenever the boundary falls on a tool message.
  it('never starts the kept window on an orphaned tool result', () => {
    const messages = [
      ...chatter(20),
      toolUse(21, 'listUpcomingJobs', 'toolu_1'),
      toolResult(22, 'toolu_1'),
      ...chatter(11, 23),
    ]
    // 33 messages: a naive keep-last-12 starts at index 21, the tool_result.
    expect(messages).toHaveLength(33)
    expect(messages[messages.length - KEEP_RECENT].role).toBe('tool')

    const plan = planContextWindow(messages, 0)

    expect(plan.keep[0].role).not.toBe('tool')
    // Pulled back one, so the tool_use that the result answers is kept with it.
    expect(plan.keep[0].seq).toBe(21)
    expect(plan.keep).toHaveLength(KEEP_RECENT + 1)
  })

  it('walks back past a run of consecutive tool results', () => {
    const messages = [
      ...chatter(20),
      toolUse(21, 'listUpcomingJobs', 'toolu_1'),
      toolResult(22, 'toolu_1'),
      toolResult(23, 'toolu_1'),
      toolResult(24, 'toolu_1'),
      ...chatter(9, 25),
    ]

    const plan = planContextWindow(messages, 0)

    expect(plan.keep[0].role).toBe('assistant')
    expect(plan.keep[0].seq).toBe(21)
    expect(plan.toSummarize.every((m) => m.seq < 21)).toBe(true)
  })

  it('keeps the window intact rather than emitting an invalid transcript', () => {
    // Every message after the first is a tool result, so there is no safe cut
    // anywhere inside the window.
    const messages = [
      toolUse(1, 'listUpcomingJobs', 'toolu_1'),
      ...Array.from({ length: SUMMARIZE_ABOVE + 4 }, (_, i) => toolResult(2 + i, 'toolu_1')),
    ]

    const plan = planContextWindow(messages, 0)

    expect(plan.toSummarize).toEqual([])
    expect(plan.keep).toHaveLength(messages.length)
    expect(plan.summarizedThroughSeq).toBe(0)
  })

  it('summarizes repeatedly as a conversation keeps growing', () => {
    const first = planContextWindow(chatter(30), 0)
    expect(first.toSummarize).toHaveLength(18)

    // Second pass sees only what is above the new watermark, plus new traffic.
    const remaining = [...first.keep, ...chatter(20, 31)]
    const second = planContextWindow(remaining, first.summarizedThroughSeq)

    expect(second.toSummarize.length).toBeGreaterThan(0)
    expect(second.summarizedThroughSeq).toBeGreaterThan(first.summarizedThroughSeq)
    expect(second.keep).toHaveLength(KEEP_RECENT)
  })
})

describe('transcribeForSummary', () => {
  it('labels each side and keeps the text', () => {
    const transcript = transcribeForSummary([
      text(1, 'user', 'book a move for the Smiths'),
      text(2, 'assistant', 'which date?'),
    ])

    expect(transcript).toBe('Dispatcher: book a move for the Smiths\nAssistant: which date?')
  })

  it('records that a tool ran without dumping its arguments', () => {
    const transcript = transcribeForSummary([
      toolUse(1, 'listUnpaidInvoices', 'toolu_1'),
      toolResult(2, 'toolu_1'),
    ])

    expect(transcript).toContain('[called listUnpaidInvoices]')
    expect(transcript).toContain('[tool returned data]')
    expect(transcript).not.toContain('input')
  })

  it('distinguishes a failed tool call from a successful one', () => {
    const transcript = transcribeForSummary([toolResult(1, 'toolu_1', true)])

    expect(transcript).toContain('[tool failed]')
  })

  it('skips messages with no readable content', () => {
    const transcript = transcribeForSummary([
      { seq: 1, role: 'assistant', content: [{ type: 'thinking', thinking: '' }] },
      text(2, 'user', 'hello'),
    ])

    expect(transcript).toBe('Dispatcher: hello')
  })
})
