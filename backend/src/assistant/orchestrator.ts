import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { ASSISTANT_MODEL, anthropic } from '../lib/anthropic.js'
import { logger } from '../lib/logger.js'
import type { AssistantBackend, ToolName, ToolSpec } from './contract.js'
import { TOOL_SPECS, ToolError, findToolSpec } from './contract.js'

// The AI layer. It knows about the abstract tool contract and nothing else — no
// MovingDesk service, table, or route is reachable from this file. Swapping the
// product underneath means writing a new AssistantBackend, not touching this.

export interface TurnMessage {
  role: 'user' | 'assistant' | 'tool'
  content: unknown[]
}

// A mutating tool call the model wants to make. Held, not executed: the Mini App
// renders `summary` on a confirm button and the write happens only after the
// user taps it. Never constructed for a read-only tool.
export interface PendingAction {
  toolUseId: string
  tool: ToolName
  input: unknown
  summary: string
}

export interface TurnResult {
  appended: TurnMessage[]
  pendingAction: PendingAction | null
}

// One user message can legitimately need several reads ("who owes us money" →
// find the client → check their jobs). The cap exists so a model that loops on a
// failing tool cannot bill indefinitely.
const MAX_TOOL_ROUNDS = 8

// Non-streaming request, so this stays under the SDK's HTTP timeout while
// leaving adaptive thinking room to work.
const MAX_TOKENS = 16_000

const SYSTEM_PROMPT = `You are the MovingDesk assistant. You help the owner or dispatcher of a small US moving company run their day, from inside a chat window on their phone.

You have tools that read and change real company data. Use them rather than guessing:
- Never state a job, invoice, client, date, or price from memory. Call a tool and report what it returns.
- Call one tool at a time, and read its result before deciding what to do next.
- If a tool returns nothing, say so plainly instead of filling the gap.
- Before creating or changing anything you need concrete details. Ask for what is missing in one short question rather than inventing an address, a date, or a client.

Writes are confirmed by the user, not by you. When you call a tool that changes data, the app shows the user a confirm button and nothing happens until they tap it. So propose the action and stop — do not claim you have created or changed something, and do not ask "shall I go ahead?" in text. The button is the question.

How to write:
This is a phone-sized chat, so keep replies to a couple of sentences. Lead with the answer. Numbers and names come from tool results, so quote them exactly. Prices are whole US dollars ($480). Dates read as "Jun 15, 2026". Phone numbers read as (949) 555-0100. Never use European date or number formats.

Answer what was asked, at the scope asked. Make routine judgment calls yourself and check in only when two readings would lead to genuinely different work. Do not add steps the user did not ask for, and do not re-verify a tool result you just received.

If the user asks for something no tool covers, say what you cannot do and name the screen in the app where they can do it themselves.`

function toolDefinitions(): Anthropic.Tool[] {
  return TOOL_SPECS.map((spec) => {
    // Zod is the source of truth for both validation and the schema the model
    // sees, so a parameter can never be documented one way and checked another.
    const schema = z.toJSONSchema(spec.schema, { target: 'draft-7' }) as Record<string, unknown>
    delete schema.$schema

    return {
      name: spec.name,
      description: spec.description,
      input_schema: schema as Anthropic.Tool.InputSchema,
    }
  })
}

// Anthropic has only user and assistant roles; a stored `tool` message is a user
// turn carrying tool_result blocks.
function toApiMessages(history: readonly TurnMessage[]): Anthropic.MessageParam[] {
  return history.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content as Anthropic.ContentBlockParam[],
  }))
}

function systemPrompt(companyName: string, summary: string | null): string {
  const parts = [SYSTEM_PROMPT, `The company you work for is "${companyName}".`]
  if (summary) {
    parts.push(
      `Summary of earlier conversation with this user, which is no longer shown in full:\n${summary}`,
    )
  }
  return parts.join('\n\n')
}

function toolResultMessage(toolUseId: string, text: string, isError = false): TurnMessage {
  return {
    role: 'tool',
    content: [
      { type: 'tool_result', tool_use_id: toolUseId, content: [{ type: 'text', text }], is_error: isError },
    ],
  }
}

function findToolUse(content: readonly unknown[]): Anthropic.ToolUseBlock | null {
  for (const block of content) {
    if (typeof block === 'object' && block !== null && (block as { type?: string }).type === 'tool_use') {
      return block as Anthropic.ToolUseBlock
    }
  }
  return null
}

function validationMessage(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ')
  return `Those arguments are not valid: ${issues}. Fix them and call the tool again, or ask the user for what is missing.`
}

// Dispatch is an explicit switch rather than an index lookup so TypeScript
// checks each input type against its method, and so adding a tool to the
// contract fails to compile until it is wired up here.
async function callBackend(
  backend: AssistantBackend,
  tool: ToolName,
  input: unknown,
): Promise<unknown> {
  switch (tool) {
    case 'listUpcomingJobs':
      return backend.listUpcomingJobs(input as Parameters<AssistantBackend['listUpcomingJobs']>[0])
    case 'listUnpaidInvoices':
      return backend.listUnpaidInvoices(
        input as Parameters<AssistantBackend['listUnpaidInvoices']>[0],
      )
    case 'findClient':
      return backend.findClient(input as Parameters<AssistantBackend['findClient']>[0])
    case 'createJob':
      return backend.createJob(input as Parameters<AssistantBackend['createJob']>[0])
    case 'setJobStatus':
      return backend.setJobStatus(input as Parameters<AssistantBackend['setJobStatus']>[0])
  }
}

// Runs a tool and turns the outcome into a message the model can read. A
// ToolError is a business answer ("that transition is not allowed") and is shown
// verbatim so the model can adapt; anything else is a bug, and the model gets a
// generic failure while the real error goes to the logs.
export async function executeTool(
  backend: AssistantBackend,
  spec: ToolSpec,
  input: unknown,
  toolUseId: string,
): Promise<TurnMessage> {
  try {
    const result = await callBackend(backend, spec.name, input)
    return toolResultMessage(toolUseId, JSON.stringify(result))
  } catch (err) {
    if (err instanceof ToolError) {
      return toolResultMessage(toolUseId, err.message, true)
    }
    logger.error({ err, tool: spec.name }, 'Assistant tool failed')
    return toolResultMessage(
      toolUseId,
      'That action failed because of a problem on our side. Tell the user it did not go through.',
      true,
    )
  }
}

export interface RunOptions {
  backend: AssistantBackend
  companyName: string
  summary: string | null
  // Replay window, oldest first, ending with the message that starts this turn.
  history: readonly TurnMessage[]
  // Results to feed back before asking the model anything — how a confirmed or
  // rejected action re-enters the loop.
  seed?: readonly TurnMessage[]
}

// What the loop should do after the model asked for a tool.
type ToolOutcome =
  | { kind: 'answered'; message: TurnMessage }
  | { kind: 'hold'; action: PendingAction }

// Validates a tool call and either answers it or holds it for confirmation. The
// mutates check is the confirmation gate: a write returns 'hold' before the
// backend is touched, and this is the only place that distinction is made.
async function handleToolUse(
  backend: AssistantBackend,
  toolUse: Anthropic.ToolUseBlock,
): Promise<ToolOutcome> {
  const spec = findToolSpec(toolUse.name)
  if (!spec) {
    return {
      kind: 'answered',
      message: toolResultMessage(toolUse.id, `There is no tool called "${toolUse.name}".`, true),
    }
  }

  const parsed = spec.schema.safeParse(toolUse.input)
  if (!parsed.success) {
    return {
      kind: 'answered',
      message: toolResultMessage(toolUse.id, validationMessage(parsed.error), true),
    }
  }

  if (spec.mutates) {
    return {
      kind: 'hold',
      action: {
        toolUseId: toolUse.id,
        tool: spec.name,
        input: parsed.data,
        summary: (spec.summarize as (input: unknown) => string)(parsed.data),
      },
    }
  }

  return { kind: 'answered', message: await executeTool(backend, spec, parsed.data, toolUse.id) }
}

function askModel(
  options: RunOptions,
  system: string,
  tools: Anthropic.Tool[],
  appended: readonly TurnMessage[],
): Promise<Anthropic.Message> {
  return anthropic.messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    // Interactive chat on a phone: `medium` keeps replies quick and is strong
    // enough for this tool surface. Raise it if the assistant starts
    // mis-sequencing multi-step bookings.
    output_config: { effort: 'medium' },
    system,
    tools,
    // At most one tool per assistant turn. With parallel calls a single message
    // could mix reads and a write, and the API requires every tool_use in a
    // message to be answered together — so holding one for confirmation would
    // mean holding the reads too.
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: toApiMessages([...options.history, ...appended]),
  })
}

// Closes a turn the model could not finish, so the user is told something rather
// than left looking at a silent chat.
function giveUpMessage(): TurnMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: "I couldn't finish that — I got stuck looking things up. Could you try asking a smaller part of it?",
      },
    ],
  }
}

// Drives the conversation until the model stops calling tools, or until it asks
// for a write and the loop hands control back to the user.
export async function runTurn(options: RunOptions): Promise<TurnResult> {
  const appended: TurnMessage[] = [...(options.seed ?? [])]
  const system = systemPrompt(options.companyName, options.summary)
  const tools = toolDefinitions()

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await askModel(options, system, tools, appended)
    appended.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') return { appended, pendingAction: null }

    const toolUse = findToolUse(response.content)
    if (!toolUse) {
      // stop_reason says tool_use but no block carries it. Nothing to answer, so
      // treat the turn as finished rather than sending an empty tool_result.
      logger.warn({ stopReason: response.stop_reason }, 'Assistant turn claimed tool_use with no block')
      return { appended, pendingAction: null }
    }

    const outcome = await handleToolUse(options.backend, toolUse)
    if (outcome.kind === 'hold') return { appended, pendingAction: outcome.action }
    appended.push(outcome.message)
  }

  logger.warn('Assistant hit the tool round limit')
  appended.push(giveUpMessage())
  return { appended, pendingAction: null }
}

// Executes a held write after the user approved it, then lets the model report
// back. The confirmation itself is what makes this legal to call: nothing else in
// the module runs a mutating tool.
export async function confirmAction(
  options: RunOptions,
  action: PendingAction,
): Promise<TurnResult> {
  const spec = findToolSpec(action.tool)
  if (!spec) {
    throw new Error(`Pending action references unknown tool "${action.tool}"`)
  }

  const result = await executeTool(options.backend, spec, action.input, action.toolUseId)
  return runTurn({ ...options, seed: [result] })
}

// The user tapped no. The refusal goes back as a tool result so the transcript
// records that the action was proposed and declined, and the model answers
// knowing it did not happen.
export async function rejectAction(
  options: RunOptions,
  action: PendingAction,
): Promise<TurnResult> {
  const declined = toolResultMessage(
    action.toolUseId,
    'The user declined this action, so it was not performed. Acknowledge briefly and ask what they would like instead.',
    true,
  )
  return runTurn({ ...options, seed: [declined] })
}
