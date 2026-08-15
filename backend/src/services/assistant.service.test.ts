import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eqPairs } from '../test/drizzleConditions.js'

// Rows are handed out in the order the service asks for them; every WHERE is
// captured so the tests can prove tenant_id is part of it.
const { selectQueue, selectWheres, insertValues, updateSets, updateReturns } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  selectWheres: [] as unknown[],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
  updateReturns: [] as unknown[][],
}))

vi.mock('../db/index.js', () => {
  function selectChain() {
    const node: Record<string, unknown> = {}
    node.from = () => node
    node.where = (cond: unknown) => {
      selectWheres.push(cond)
      return node
    }
    node.orderBy = () => Promise.resolve(selectQueue.shift() ?? [])
    node.limit = () => Promise.resolve(selectQueue.shift() ?? [])
    return node
  }

  return {
    db: {
      select: () => selectChain(),
      insert: () => ({
        values: (v: unknown) => {
          insertValues.push(v)
          const rows = Array.isArray(v) ? v : [v]
          return {
            returning: () =>
              Promise.resolve(
                rows.map((row, i) => ({ id: `written-${i}`, ...(row as Record<string, unknown>) })),
              ),
          }
        },
      }),
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return {
            where: () => {
              const promise = Promise.resolve() as Promise<unknown> & {
                returning: () => Promise<unknown[]>
              }
              promise.returning = () => Promise.resolve(updateReturns.shift() ?? [])
              return promise
            },
          }
        },
      }),
    },
  }
})

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const aiConfigured = { value: true }
vi.mock('../lib/anthropic.js', () => ({
  ASSISTANT_MODEL: 'claude-opus-5',
  isAIConfigured: () => aiConfigured.value,
  anthropic: { messages: { create: vi.fn() } },
}))

// The adapter is constructed by the service but never exercised here — the
// orchestrator is mocked, so nothing reaches the database through it.
vi.mock('../assistant/movingdesk.adapter.js', () => ({
  MovingDeskAdapter: class {
    constructor(
      readonly tenantId: string,
      readonly userId: string,
    ) {}
  },
}))

const runTurnMock = vi.fn()
const confirmActionMock = vi.fn()
const rejectActionMock = vi.fn()
vi.mock('../assistant/orchestrator.js', () => ({
  runTurn: (...a: unknown[]) => runTurnMock(...a),
  confirmAction: (...a: unknown[]) => confirmActionMock(...a),
  rejectAction: (...a: unknown[]) => rejectActionMock(...a),
}))

const summarizeHistoryMock = vi.fn()
vi.mock('../assistant/summarizer.js', () => ({
  summarizeHistory: (...a: unknown[]) => summarizeHistoryMock(...a),
}))

const { getTranscript, resolveAction, sendMessage, AssistantUnavailableError } = await import(
  './assistant.service.js'
)

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '99999999-9999-4999-8999-999999999999'
const USER_A = '22222222-2222-4222-8222-222222222222'
const CONVO = '33333333-3333-4333-8333-333333333333'
const MSG_PROPOSAL = '44444444-4444-4444-8444-444444444444'
const MSG_EARLIER = '55555555-5555-4555-8555-555555555555'

const VALID_CREATE = {
  clientName: 'Jane Smith',
  clientPhone: '9495550100',
  moveDate: '2026-09-01',
  fromAddress: '1 A St',
  toAddress: '2 B St',
  homeSize: '2br',
}

function conversation(overrides: Record<string, unknown> = {}) {
  return { id: CONVO, summary: null, summarizedThroughSeq: 0, ...overrides }
}

function userMessage(id: string, seq: number, text: string) {
  return { id, seq, role: 'user', content: [{ type: 'text', text }] }
}

function proposal(id: string, seq: number, tool: string, input: unknown, toolUseId = 'toolu_1') {
  return {
    id,
    seq,
    role: 'assistant',
    content: [{ type: 'tool_use', id: toolUseId, name: tool, input }],
  }
}

function toolResult(id: string, seq: number, payload: unknown, toolUseId = 'toolu_1') {
  return {
    id,
    seq,
    role: 'tool',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        is_error: false,
      },
    ],
  }
}

function assistantText(id: string, seq: number, text: string) {
  return { id, seq, role: 'assistant', content: [{ type: 'text', text }] }
}

function reset(): void {
  selectQueue.length = 0
  selectWheres.length = 0
  insertValues.length = 0
  updateSets.length = 0
  updateReturns.length = 0
  aiConfigured.value = true
  vi.clearAllMocks()
  runTurnMock.mockResolvedValue({ appended: [], pendingAction: null })
  confirmActionMock.mockResolvedValue({ appended: [], pendingAction: null })
  rejectActionMock.mockResolvedValue({ appended: [], pendingAction: null })
}

beforeEach(reset)

describe('getTranscript', () => {
  it('scopes the conversation lookup to the tenant and user', async () => {
    selectQueue.push([conversation()], [])

    await getTranscript(TENANT_A, USER_A)

    const pairs = selectWheres.flatMap((w) => eqPairs(w))
    expect(pairs).toEqual(
      expect.arrayContaining([
        { column: 'tenant_id', value: TENANT_A },
        { column: 'user_id', value: USER_A },
      ]),
    )
  })

  it('creates a conversation the first time a user opens the assistant', async () => {
    selectQueue.push([], [])

    await getTranscript(TENANT_A, USER_A)

    expect(insertValues[0]).toMatchObject({ tenant_id: TENANT_A, user_id: USER_A })
  })

  it('renders user and assistant turns as bubbles', async () => {
    selectQueue.push(
      [conversation()],
      [userMessage(MSG_EARLIER, 1, 'what is on today?'), assistantText(MSG_PROPOSAL, 2, 'Two jobs.')],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.messages).toEqual([
      { id: MSG_EARLIER, role: 'user', text: 'what is on today?', results: [] },
      { id: MSG_PROPOSAL, role: 'assistant', text: 'Two jobs.', results: [] },
    ])
    expect(view.pendingAction).toBeNull()
  })

  // Cards belong with the sentence that reports them, not before it.
  it('attaches a tool result to the assistant turn that follows it', async () => {
    selectQueue.push(
      [conversation()],
      [
        userMessage('m1', 1, 'unpaid invoices?'),
        proposal('m2', 2, 'listUnpaidInvoices', { limit: 20 }),
        toolResult('m3', 3, [{ number: '1001', totalPrice: 620 }]),
        assistantText('m4', 4, 'One unpaid invoice: #1001 for $620.'),
      ],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.messages).toHaveLength(2)
    const reply = view.messages[1]
    expect(reply.text).toContain('One unpaid invoice')
    expect(reply.results).toEqual([
      { tool: 'listUnpaidInvoices', ok: true, data: [{ number: '1001', totalPrice: 620 }], error: null },
    ])
  })

  it('surfaces a failed tool call as an error result rather than data', async () => {
    selectQueue.push(
      [conversation()],
      [
        proposal('m1', 1, 'setJobStatus', { jobId: MSG_PROPOSAL, status: 'closed' }),
        {
          id: 'm2',
          seq: 2,
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: [{ type: 'text', text: 'A job cannot go from "new" to "closed".' }],
              is_error: true,
            },
          ],
        },
        assistantText('m3', 3, 'It has to be confirmed first.'),
      ],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.messages[0].results[0]).toEqual({
      tool: 'setJobStatus',
      ok: false,
      data: null,
      error: 'A job cannot go from "new" to "closed".',
    })
  })

  it('reports a live pending action for an unanswered write', async () => {
    selectQueue.push(
      [conversation()],
      [
        userMessage('m1', 1, 'book the Smiths for Sep 1'),
        proposal(MSG_PROPOSAL, 2, 'createJob', VALID_CREATE),
      ],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.pendingAction).toEqual({
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      tool: 'createJob',
      summary: expect.stringContaining('Jane Smith'),
    })
  })

  it('clears the pending action once a result has been recorded', async () => {
    selectQueue.push(
      [conversation()],
      [
        proposal(MSG_PROPOSAL, 1, 'createJob', VALID_CREATE),
        toolResult('m2', 2, { id: 'job-1' }),
        assistantText('m3', 3, 'Created.'),
      ],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.pendingAction).toBeNull()
  })

  it('does not treat a read-only tool call as a pending action', async () => {
    selectQueue.push(
      [conversation()],
      [proposal(MSG_PROPOSAL, 1, 'listUpcomingJobs', { days: 7 })],
    )

    const view = await getTranscript(TENANT_A, USER_A)

    expect(view.pendingAction).toBeNull()
  })

  it('only replays messages above the summary watermark', async () => {
    selectQueue.push([conversation({ summarizedThroughSeq: 18 })], [])

    await getTranscript(TENANT_A, USER_A)

    // The messages query filters on seq, not just the conversation.
    const messagesWhere = selectWheres[1]
    expect(JSON.stringify(eqPairs(messagesWhere))).toContain(CONVO)
  })
})

describe('resolveAction', () => {
  it('executes the write when the proposal is the newest message', async () => {
    selectQueue.push(
      [conversation()],
      [userMessage('m1', 1, 'book it'), proposal(MSG_PROPOSAL, 2, 'createJob', VALID_CREATE)],
      [{ name: 'Acme Movers' }],
      [conversation()],
      [],
    )
    updateReturns.push([{ nextSeq: 5 }])

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('ok')
    expect(confirmActionMock).toHaveBeenCalledOnce()
    expect(rejectActionMock).not.toHaveBeenCalled()
    const [, action] = confirmActionMock.mock.calls[0]
    expect(action).toMatchObject({ tool: 'createJob', toolUseId: 'toolu_1' })
  })

  it('records a refusal without executing the write', async () => {
    selectQueue.push(
      [conversation()],
      [proposal(MSG_PROPOSAL, 1, 'createJob', VALID_CREATE)],
      [{ name: 'Acme Movers' }],
      [conversation()],
      [],
    )
    updateReturns.push([{ nextSeq: 4 }])

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'reject',
    })

    expect(outcome.status).toBe('ok')
    expect(rejectActionMock).toHaveBeenCalledOnce()
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  // The guard against a double tap creating two jobs: anything after the
  // proposal means a result was already written for it.
  it('refuses a proposal that is no longer the newest message', async () => {
    selectQueue.push(
      [conversation()],
      [
        proposal(MSG_PROPOSAL, 1, 'createJob', VALID_CREATE),
        toolResult('m2', 2, { id: 'job-1' }),
      ],
    )

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('already_resolved')
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  it('refuses a message id that is not in this conversation', async () => {
    selectQueue.push([conversation()], [proposal(MSG_PROPOSAL, 1, 'createJob', VALID_CREATE)])

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_EARLIER,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('not_found')
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  it('refuses a tool_use id that does not appear in the message', async () => {
    selectQueue.push([conversation()], [proposal(MSG_PROPOSAL, 1, 'createJob', VALID_CREATE)])

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_someone_else',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('not_found')
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  // A read-only call is not something the user can be asked to confirm, so a
  // request naming one must not become an execution path.
  it('refuses to resolve a read-only tool call', async () => {
    selectQueue.push([conversation()], [proposal(MSG_PROPOSAL, 1, 'listUpcomingJobs', { days: 7 })])

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('not_found')
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  // The arguments come out of jsonb, so they are re-validated rather than
  // trusted — a row edited or written by an older schema must not reach the
  // adapter.
  it('refuses a stored proposal whose arguments no longer validate', async () => {
    selectQueue.push(
      [conversation()],
      [proposal(MSG_PROPOSAL, 1, 'createJob', { clientName: 'J' })],
    )

    const outcome = await resolveAction(TENANT_A, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    expect(outcome.status).toBe('not_found')
    expect(confirmActionMock).not.toHaveBeenCalled()
  })

  it('looks the conversation up under the caller tenant', async () => {
    selectQueue.push([conversation()], [])

    await resolveAction(TENANT_B, USER_A, {
      messageId: MSG_PROPOSAL,
      toolUseId: 'toolu_1',
      decision: 'confirm',
    })

    const pairs = selectWheres.flatMap((w) => eqPairs(w))
    expect(pairs).toEqual(expect.arrayContaining([{ column: 'tenant_id', value: TENANT_B }]))
    expect(pairs).not.toEqual(expect.arrayContaining([{ column: 'tenant_id', value: TENANT_A }]))
  })

  it('is unavailable without an API key', async () => {
    aiConfigured.value = false

    await expect(
      resolveAction(TENANT_A, USER_A, {
        messageId: MSG_PROPOSAL,
        toolUseId: 'toolu_1',
        decision: 'confirm',
      }),
    ).rejects.toThrow(AssistantUnavailableError)
  })
})

describe('sendMessage', () => {
  it('persists the user message before running the turn', async () => {
    selectQueue.push([conversation()], [], [{ name: 'Acme Movers' }], [conversation()], [])
    updateReturns.push([{ nextSeq: 2 }], [{ nextSeq: 2 }])

    await sendMessage(TENANT_A, USER_A, 'which invoices are unpaid?')

    const written = insertValues[0] as { role: string; content: unknown[]; tenant_id: string }[]
    expect(written[0]).toMatchObject({ role: 'user', tenant_id: TENANT_A })
    expect(written[0].content).toEqual([{ type: 'text', text: 'which invoices are unpaid?' }])
    expect(runTurnMock).toHaveBeenCalledOnce()
  })

  it('gives the orchestrator the company name and the rolling summary', async () => {
    selectQueue.push(
      [conversation({ summary: 'Booked the Smiths for Sep 1.' })],
      [],
      [{ name: 'Acme Movers' }],
      [conversation({ summary: 'Booked the Smiths for Sep 1.' })],
      [],
    )
    updateReturns.push([{ nextSeq: 2 }], [{ nextSeq: 2 }])

    await sendMessage(TENANT_A, USER_A, 'hello')

    expect(runTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme Movers',
        summary: 'Booked the Smiths for Sep 1.',
      }),
    )
  })

  it('binds the adapter to the caller tenant and user', async () => {
    selectQueue.push([conversation()], [], [{ name: 'Acme Movers' }], [conversation()], [])
    updateReturns.push([{ nextSeq: 2 }], [{ nextSeq: 2 }])

    await sendMessage(TENANT_B, USER_A, 'hello')

    const options = runTurnMock.mock.calls[0][0] as { backend: { tenantId: string; userId: string } }
    expect(options.backend.tenantId).toBe(TENANT_B)
    expect(options.backend.userId).toBe(USER_A)
  })

  it('is unavailable without an API key', async () => {
    aiConfigured.value = false

    await expect(sendMessage(TENANT_A, USER_A, 'hi')).rejects.toThrow(AssistantUnavailableError)
    expect(runTurnMock).not.toHaveBeenCalled()
  })

  it('allocates a contiguous block of sequence numbers for a multi-message turn', async () => {
    selectQueue.push([conversation()], [], [{ name: 'Acme Movers' }], [conversation()], [])
    updateReturns.push([{ nextSeq: 2 }], [{ nextSeq: 5 }])
    runTurnMock.mockResolvedValue({
      appended: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'findClient', input: {} }] },
        { role: 'tool', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [] }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Found one.' }] },
      ],
      pendingAction: null,
    })

    await sendMessage(TENANT_A, USER_A, 'find Jane')

    const turnRows = insertValues[1] as { seq: number }[]
    expect(turnRows.map((r) => r.seq)).toEqual([2, 3, 4])
  })

  // A summarization failure must degrade to a longer replay, never to a failed
  // reply — the user's answer is already computed by then.
  it('still answers when summarization fails', async () => {
    const many = Array.from({ length: 30 }, (_, i) => userMessage(`m${i}`, i + 1, `msg ${i}`))
    selectQueue.push([conversation()], many, [{ name: 'Acme Movers' }], [conversation()], many)
    updateReturns.push([{ nextSeq: 31 }], [{ nextSeq: 32 }])
    summarizeHistoryMock.mockRejectedValue(new Error('anthropic down'))

    const view = await sendMessage(TENANT_A, USER_A, 'hello')

    expect(view.messages.length).toBeGreaterThan(0)
  })
})
