import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantBackend, JobSummary } from './contract.js'
import { ToolError } from './contract.js'

// Scripted model turns: each entry is one Messages API response, handed out in
// order. Lets the loop be driven through every branch without a network call.
const { responses, requests } = vi.hoisted(() => ({
  responses: [] as unknown[],
  requests: [] as Record<string, unknown>[],
}))

vi.mock('../lib/anthropic.js', () => ({
  ASSISTANT_MODEL: 'claude-opus-5',
  isAIConfigured: () => true,
  anthropic: {
    messages: {
      create: (params: Record<string, unknown>) => {
        requests.push(params)
        const next = responses.shift()
        if (!next) throw new Error('orchestrator asked for more model turns than the test scripted')
        return Promise.resolve(next)
      },
    },
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const { confirmAction, rejectAction, runTurn } = await import('./orchestrator.js')

function say(text: string): unknown {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' }
}

function callTool(name: string, input: unknown, id = 'toolu_1'): unknown {
  return { content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' }
}

const JOB: JobSummary = {
  id: '44444444-4444-4444-8444-444444444444',
  reference: '#44444444',
  status: 'new',
  moveDate: '2026-09-01',
  fromAddress: '1 A St',
  toAddress: '2 B St',
  homeSize: '2br',
  packing: false,
  totalPrice: 480,
  clientName: 'Jane Smith',
  clientPhone: '(949) 555-0100',
  crewName: null,
}

function backend(overrides: Partial<AssistantBackend> = {}): AssistantBackend {
  return {
    listUpcomingJobs: vi.fn(async () => [JOB]),
    listUnpaidInvoices: vi.fn(async () => []),
    findClient: vi.fn(async () => []),
    createJob: vi.fn(async () => JOB),
    setJobStatus: vi.fn(async () => ({ ...JOB, status: 'confirmed' })),
    ...overrides,
  }
}

function options(back: AssistantBackend, history: { role: 'user'; content: unknown[] }[]) {
  return { backend: back, companyName: 'Acme Movers', summary: null, history }
}

const ASK = [{ role: 'user' as const, content: [{ type: 'text', text: 'what is on today?' }] }]

const VALID_CREATE = {
  clientName: 'Jane Smith',
  clientPhone: '9495550100',
  moveDate: '2026-09-01',
  fromAddress: '1 A St',
  toAddress: '2 B St',
  homeSize: '2br',
}

beforeEach(() => {
  responses.length = 0
  requests.length = 0
})

describe('runTurn — read-only tools', () => {
  it('executes a read tool without asking for confirmation and returns no pending action', async () => {
    const back = backend()
    responses.push(callTool('listUpcomingJobs', { days: 1 }), say('One job today.'))

    const result = await runTurn(options(back, ASK))

    expect(back.listUpcomingJobs).toHaveBeenCalledWith({ days: 1 })
    expect(result.pendingAction).toBeNull()
    // assistant(tool_use) → tool(result) → assistant(text)
    expect(result.appended.map((m) => m.role)).toEqual(['assistant', 'tool', 'assistant'])
  })

  it('applies schema defaults before calling the backend', async () => {
    const back = backend()
    responses.push(callTool('listUpcomingJobs', {}), say('Nothing this week.'))

    await runTurn(options(back, ASK))

    expect(back.listUpcomingJobs).toHaveBeenCalledWith({ days: 7 })
  })

  it('feeds the tool payload back as a tool_result the model can read', async () => {
    responses.push(callTool('listUpcomingJobs', { days: 1 }), say('One job.'))

    const result = await runTurn(options(backend(), ASK))

    const toolMessage = result.appended[1]
    const block = toolMessage.content[0] as { type: string; tool_use_id: string; is_error: boolean; content: { text: string }[] }
    expect(block.type).toBe('tool_result')
    expect(block.tool_use_id).toBe('toolu_1')
    expect(block.is_error).toBe(false)
    expect(JSON.parse(block.content[0].text)).toEqual([JOB])
  })
})

describe('runTurn — confirmation before writes', () => {
  it('holds a createJob call instead of executing it', async () => {
    const back = backend()
    responses.push(callTool('createJob', VALID_CREATE))

    const result = await runTurn(options(back, ASK))

    expect(back.createJob).not.toHaveBeenCalled()
    expect(result.pendingAction).toMatchObject({ tool: 'createJob', toolUseId: 'toolu_1' })
    expect(result.pendingAction?.summary).toContain('Jane Smith')
    // The loop stopped: no tool_result was invented for the held call.
    expect(result.appended.map((m) => m.role)).toEqual(['assistant'])
  })

  it('holds a setJobStatus call instead of executing it', async () => {
    const back = backend()
    responses.push(callTool('setJobStatus', { jobId: JOB.id, status: 'confirmed' }))

    const result = await runTurn(options(back, ASK))

    expect(back.setJobStatus).not.toHaveBeenCalled()
    expect(result.pendingAction?.tool).toBe('setJobStatus')
  })

  it('stops the loop at the write even when reads came first', async () => {
    const back = backend()
    responses.push(
      callTool('listUpcomingJobs', { days: 7 }),
      callTool('createJob', VALID_CREATE, 'toolu_2'),
    )

    const result = await runTurn(options(back, ASK))

    expect(back.listUpcomingJobs).toHaveBeenCalledOnce()
    expect(back.createJob).not.toHaveBeenCalled()
    expect(result.pendingAction?.toolUseId).toBe('toolu_2')
  })

  it('never lets the model batch a write alongside other calls', async () => {
    responses.push(say('Nothing to do.'))

    await runTurn(options(backend(), ASK))

    expect(requests[0].tool_choice).toEqual({ type: 'auto', disable_parallel_tool_use: true })
  })

  it('does not hold an invalid write — it asks the model to fix the arguments', async () => {
    const back = backend()
    responses.push(
      callTool('createJob', { clientName: 'J' }),
      say('What is the pickup address?'),
    )

    const result = await runTurn(options(back, ASK))

    expect(back.createJob).not.toHaveBeenCalled()
    expect(result.pendingAction).toBeNull()
    const block = result.appended[1].content[0] as { is_error: boolean; content: { text: string }[] }
    expect(block.is_error).toBe(true)
    expect(block.content[0].text).toContain('not valid')
  })
})

describe('confirmAction', () => {
  it('performs the write only once the user has confirmed', async () => {
    const back = backend()
    responses.push(callTool('createJob', VALID_CREATE))
    const held = await runTurn(options(back, ASK))
    expect(back.createJob).not.toHaveBeenCalled()

    responses.push(say('Created — job #44444444 on Sep 1, 2026.'))
    const resumed = await confirmAction(
      options(back, ASK),
      held.pendingAction!,
    )

    expect(back.createJob).toHaveBeenCalledOnce()
    expect(back.createJob).toHaveBeenCalledWith(expect.objectContaining({ clientName: 'Jane Smith' }))
    expect(resumed.pendingAction).toBeNull()
    // tool(result of the confirmed write) → assistant(report)
    expect(resumed.appended.map((m) => m.role)).toEqual(['tool', 'assistant'])
  })

  it('reports a rejected transition back to the model instead of throwing', async () => {
    const back = backend({
      setJobStatus: vi.fn(async () => {
        throw new ToolError('A job cannot go from "new" to "closed".')
      }),
    })
    responses.push(callTool('setJobStatus', { jobId: JOB.id, status: 'closed' }))
    const held = await runTurn(options(back, ASK))

    responses.push(say('That job has to be confirmed first.'))
    const resumed = await confirmAction(options(back, ASK), held.pendingAction!)

    const block = resumed.appended[0].content[0] as { is_error: boolean; content: { text: string }[] }
    expect(block.is_error).toBe(true)
    expect(block.content[0].text).toContain('cannot go from')
    expect(resumed.pendingAction).toBeNull()
  })

  it('hides an unexpected adapter failure from the model', async () => {
    const back = backend({
      createJob: vi.fn(async () => {
        throw new Error('duplicate key value violates unique constraint "clients_tenant_phone_idx"')
      }),
    })
    responses.push(callTool('createJob', VALID_CREATE))
    const held = await runTurn(options(back, ASK))

    responses.push(say("That didn't go through."))
    const resumed = await confirmAction(options(back, ASK), held.pendingAction!)

    const block = resumed.appended[0].content[0] as { is_error: boolean; content: { text: string }[] }
    expect(block.is_error).toBe(true)
    expect(block.content[0].text).not.toContain('clients_tenant_phone_idx')
    expect(block.content[0].text).toContain('problem on our side')
  })
})

describe('rejectAction', () => {
  it('does not perform the write and records the refusal', async () => {
    const back = backend()
    responses.push(callTool('createJob', VALID_CREATE))
    const held = await runTurn(options(back, ASK))

    responses.push(say('No problem — what would you like instead?'))
    const resumed = await rejectAction(options(back, ASK), held.pendingAction!)

    expect(back.createJob).not.toHaveBeenCalled()
    const block = resumed.appended[0].content[0] as { is_error: boolean; content: { text: string }[] }
    expect(block.is_error).toBe(true)
    expect(block.content[0].text).toContain('declined')
    expect(resumed.pendingAction).toBeNull()
  })
})

describe('runTurn — request shape', () => {
  it('advertises every tool in the contract, with its schema', async () => {
    responses.push(say('hi'))

    await runTurn(options(backend(), ASK))

    const tools = requests[0].tools as { name: string; description: string; input_schema: Record<string, unknown> }[]
    expect(tools.map((t) => t.name).sort()).toEqual([
      'createJob',
      'findClient',
      'listUnpaidInvoices',
      'listUpcomingJobs',
      'setJobStatus',
    ])
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.input_schema.type).toBe('object')
      // $schema is stripped: the Messages API takes a bare JSON Schema object.
      expect(tool.input_schema.$schema).toBeUndefined()
    }
  })

  it('puts the company name in the system prompt and omits an absent summary', async () => {
    responses.push(say('hi'))

    await runTurn(options(backend(), ASK))

    expect(requests[0].system).toContain('Acme Movers')
    expect(requests[0].system).not.toContain('Summary of earlier conversation')
  })

  it('carries the rolling summary into the system prompt', async () => {
    responses.push(say('hi'))

    await runTurn({ ...options(backend(), ASK), summary: 'Booked the Smiths for Sep 1.' })

    expect(requests[0].system).toContain('Summary of earlier conversation')
    expect(requests[0].system).toContain('Booked the Smiths for Sep 1.')
  })

  it('replays stored tool messages as user turns', async () => {
    responses.push(say('hi'))
    const history = [
      { role: 'user' as const, content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant' as const, content: [{ type: 'tool_use', id: 'toolu_1', name: 'findClient', input: {} }] },
      { role: 'tool' as const, content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [] }] },
    ]

    await runTurn({ ...options(backend(), ASK), history })

    const sent = requests[0].messages as { role: string }[]
    expect(sent.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  })

  it('does not send sampling parameters, which the model rejects', async () => {
    responses.push(say('hi'))

    await runTurn(options(backend(), ASK))

    expect(requests[0].temperature).toBeUndefined()
    expect(requests[0].top_p).toBeUndefined()
    expect(requests[0].top_k).toBeUndefined()
  })
})

describe('runTurn — resilience', () => {
  it('tells the model when it names a tool that does not exist', async () => {
    responses.push(callTool('deleteEverything', {}), say('I cannot do that.'))

    const result = await runTurn(options(backend(), ASK))

    const block = result.appended[1].content[0] as { is_error: boolean; content: { text: string }[] }
    expect(block.is_error).toBe(true)
    expect(block.content[0].text).toContain('no tool called')
  })

  it('stops after the round limit with a message for the user', async () => {
    // Always asks for the same read, never concludes.
    for (let i = 0; i < 12; i++) responses.push(callTool('listUpcomingJobs', { days: 1 }))

    const result = await runTurn(options(backend(), ASK))

    expect(result.pendingAction).toBeNull()
    const last = result.appended[result.appended.length - 1]
    expect(last.role).toBe('assistant')
    expect((last.content[0] as { text: string }).text).toContain("couldn't finish")
    // 8 rounds of (assistant + tool) plus the closing message.
    expect(result.appended).toHaveLength(17)
  })

  it('ends the turn when stop_reason claims a tool call that is not there', async () => {
    responses.push({ content: [{ type: 'text', text: 'hmm' }], stop_reason: 'tool_use' })

    const result = await runTurn(options(backend(), ASK))

    expect(result.pendingAction).toBeNull()
    expect(result.appended).toHaveLength(1)
  })
})
