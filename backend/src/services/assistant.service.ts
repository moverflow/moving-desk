import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { assistantConversations, assistantMessages, tenants } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { isAIConfigured } from '../lib/anthropic.js'
import { MovingDeskAdapter } from '../assistant/movingdesk.adapter.js'
import { findToolSpec, type ToolName } from '../assistant/contract.js'
import { planContextWindow, type StoredMessage } from '../assistant/context.js'
import { summarizeHistory } from '../assistant/summarizer.js'
import {
  confirmAction,
  rejectAction,
  runTurn,
  type PendingAction,
  type RunOptions,
  type TurnMessage,
  type TurnResult,
} from '../assistant/orchestrator.js'

// Persistence and turn plumbing for the assistant. This is the layer that knows
// about tables and tenants; the AI layer under src/assistant/ does not.

interface ConversationRow {
  id: string
  summary: string | null
  summarizedThroughSeq: number
}

async function getOrCreateConversation(
  tenantId: string,
  userId: string,
): Promise<ConversationRow> {
  const [existing] = await db
    .select({
      id: assistantConversations.id,
      summary: assistantConversations.summary,
      summarizedThroughSeq: assistantConversations.summarized_through_seq,
    })
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.tenant_id, tenantId),
        eq(assistantConversations.user_id, userId),
      ),
    )
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(assistantConversations)
    .values({ tenant_id: tenantId, user_id: userId })
    .returning({
      id: assistantConversations.id,
      summary: assistantConversations.summary,
      summarizedThroughSeq: assistantConversations.summarized_through_seq,
    })

  return created
}

// Messages still replayed verbatim: everything above the summary watermark.
async function loadWindow(
  tenantId: string,
  conversation: ConversationRow,
): Promise<(StoredMessage & { id: string })[]> {
  const rows = await db
    .select({
      id: assistantMessages.id,
      seq: assistantMessages.seq,
      role: assistantMessages.role,
      content: assistantMessages.content,
    })
    .from(assistantMessages)
    .where(
      and(
        eq(assistantMessages.tenant_id, tenantId),
        eq(assistantMessages.conversation_id, conversation.id),
        gt(assistantMessages.seq, conversation.summarizedThroughSeq),
      ),
    )
    .orderBy(asc(assistantMessages.seq))

  return rows.map((row) => ({ id: row.id, seq: row.seq, role: row.role, content: row.content }))
}

// Claims a contiguous block of sequence numbers and writes the messages into it.
// The counter lives on the conversation row so the UPDATE ... RETURNING takes a
// row lock — two turns racing get disjoint blocks instead of a unique violation.
async function appendMessages(
  tenantId: string,
  conversationId: string,
  messages: readonly TurnMessage[],
): Promise<(StoredMessage & { id: string })[]> {
  if (messages.length === 0) return []

  const [claimed] = await db
    .update(assistantConversations)
    .set({
      next_seq: sql`${assistantConversations.next_seq} + ${messages.length}`,
      last_message_at: new Date(),
    })
    .where(
      and(
        eq(assistantConversations.id, conversationId),
        eq(assistantConversations.tenant_id, tenantId),
      ),
    )
    .returning({ nextSeq: assistantConversations.next_seq })

  // No row means the conversation does not belong to this tenant. Not reachable
  // through the callers here, which all resolve the conversation first — but
  // writing messages against an unclaimed range would corrupt the transcript, so
  // it fails loudly instead.
  if (!claimed) {
    throw new Error(`Assistant conversation ${conversationId} not found for this tenant`)
  }

  const firstSeq = claimed.nextSeq - messages.length

  const inserted = await db
    .insert(assistantMessages)
    .values(
      messages.map((message, index) => ({
        tenant_id: tenantId,
        conversation_id: conversationId,
        seq: firstSeq + index,
        role: message.role,
        content: message.content,
      })),
    )
    .returning({
      id: assistantMessages.id,
      seq: assistantMessages.seq,
      role: assistantMessages.role,
      content: assistantMessages.content,
    })

  return inserted.map((row) => ({ id: row.id, seq: row.seq, role: row.role, content: row.content }))
}

async function getCompanyName(tenantId: string): Promise<string> {
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return tenant?.name ?? 'the company'
}

// Compacts anything that has fallen out of the verbatim window. Best-effort: a
// failed summarization leaves the watermark where it was, so the next turn
// replays a slightly longer history and tries again — never a failed reply.
async function compact(
  tenantId: string,
  conversation: ConversationRow,
  window: readonly StoredMessage[],
): Promise<void> {
  const plan = planContextWindow([...window], conversation.summarizedThroughSeq)
  if (plan.toSummarize.length === 0) return

  try {
    const summary = await summarizeHistory(plan.toSummarize, conversation.summary)
    await db
      .update(assistantConversations)
      .set({ summary, summarized_through_seq: plan.summarizedThroughSeq })
      .where(
        and(
          eq(assistantConversations.id, conversation.id),
          eq(assistantConversations.tenant_id, tenantId),
        ),
      )
  } catch (err) {
    logger.error({ err, conversationId: conversation.id }, 'Assistant summarization failed')
  }
}

// ─── View model ───────────────────────────────────────────────────────────────
// The transcript the Mini App renders. Tool traffic becomes `results` on the
// assistant turn that reports on it, so a card and the sentence about it arrive
// together instead of the card landing first.

export interface AssistantToolResult {
  tool: ToolName
  ok: boolean
  data: unknown
  error: string | null
}

export interface AssistantViewMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  results: AssistantToolResult[]
}

export interface AssistantPendingAction {
  messageId: string
  toolUseId: string
  tool: ToolName
  summary: string
}

export interface AssistantView {
  messages: AssistantViewMessage[]
  pendingAction: AssistantPendingAction | null
}

interface Block {
  type?: string
  text?: string
  id?: string
  name?: string
  tool_use_id?: string
  is_error?: boolean
  content?: unknown
}

function blockText(block: Block): string {
  return block.type === 'text' && typeof block.text === 'string' ? block.text : ''
}

// tool_result content is the JSON the adapter returned, wrapped in a text block.
function resultPayload(block: Block): { text: string } {
  if (typeof block.content === 'string') return { text: block.content }
  if (Array.isArray(block.content)) {
    const text = (block.content as Block[]).map(blockText).join('')
    return { text }
  }
  return { text: '' }
}

function plainText(blocks: readonly Block[]): string {
  return blocks.map(blockText).join('').trim()
}

// tool_result blocks carry the adapter's JSON, so a success is parsed into data
// the Mini App can render as a card and a failure keeps its message as text.
function readToolResults(
  blocks: readonly Block[],
  toolByUseId: ReadonlyMap<string, ToolName>,
): AssistantToolResult[] {
  const results: AssistantToolResult[] = []

  for (const block of blocks) {
    if (block.type !== 'tool_result' || !block.tool_use_id) continue
    const tool = toolByUseId.get(block.tool_use_id)
    // The tool_use this answers was summarized away, so there is nothing to
    // label the card with.
    if (!tool) continue

    const { text } = resultPayload(block)
    if (block.is_error) {
      results.push({ tool, ok: false, data: null, error: text })
      continue
    }

    let data: unknown = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    results.push({ tool, ok: true, data, error: null })
  }

  return results
}

// Registers each tool_use id against its tool, and returns a proposal if this
// message asked for a write. Whether it is still live is decided by the caller:
// a later `tool` message answers it.
function readToolUses(
  messageId: string,
  blocks: readonly Block[],
  toolByUseId: Map<string, ToolName>,
): AssistantPendingAction | null {
  let proposal: AssistantPendingAction | null = null

  for (const block of blocks) {
    if (block.type !== 'tool_use' || !block.id || !block.name) continue
    const spec = findToolSpec(block.name)
    if (!spec) continue
    toolByUseId.set(block.id, spec.name)
    if (!spec.mutates) continue

    const parsed = spec.schema.safeParse((block as { input?: unknown }).input)
    if (!parsed.success) continue

    proposal = {
      messageId,
      toolUseId: block.id,
      tool: spec.name,
      summary: (spec.summarize as (input: unknown) => string)(parsed.data),
    }
  }

  return proposal
}

function buildView(messages: readonly (StoredMessage & { id: string })[]): AssistantView {
  const view: AssistantViewMessage[] = []
  // Tool results wait here until the assistant turn that reports on them, so a
  // card and the sentence about it arrive together.
  let carried: AssistantToolResult[] = []
  const toolByUseId = new Map<string, ToolName>()
  let pendingAction: AssistantPendingAction | null = null

  for (const message of messages) {
    const blocks = (message.content ?? []) as Block[]

    if (message.role === 'user') {
      const text = plainText(blocks)
      if (text) view.push({ id: message.id, role: 'user', text, results: [] })
      continue
    }

    if (message.role === 'tool') {
      carried.push(...readToolResults(blocks, toolByUseId))
      // A result exists for the proposal, so it is no longer awaiting an answer.
      pendingAction = null
      continue
    }

    pendingAction = readToolUses(message.id, blocks, toolByUseId) ?? pendingAction
    const text = plainText(blocks)
    if (text || carried.length > 0) {
      view.push({ id: message.id, role: 'assistant', text, results: carried })
      carried = []
    }
  }

  // Trailing results with no assistant turn after them still belong on screen.
  if (carried.length > 0) {
    const last = view[view.length - 1]
    if (last) last.results.push(...carried)
  }

  return { messages: view, pendingAction }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class AssistantUnavailableError extends Error {
  constructor() {
    super('The assistant is not configured on this deployment.')
    this.name = 'AssistantUnavailableError'
  }
}

export async function getTranscript(tenantId: string, userId: string): Promise<AssistantView> {
  const conversation = await getOrCreateConversation(tenantId, userId)
  const window = await loadWindow(tenantId, conversation)
  return buildView(window)
}

async function runOptions(
  tenantId: string,
  userId: string,
  conversation: ConversationRow,
  history: readonly TurnMessage[],
): Promise<RunOptions> {
  return {
    backend: new MovingDeskAdapter(tenantId, userId),
    companyName: await getCompanyName(tenantId),
    summary: conversation.summary,
    history,
  }
}

async function persistAndView(
  tenantId: string,
  conversation: ConversationRow,
  before: readonly (StoredMessage & { id: string })[],
  result: TurnResult,
): Promise<AssistantView> {
  const written = await appendMessages(tenantId, conversation.id, result.appended)
  const full = [...before, ...written]
  await compact(tenantId, conversation, full)
  return buildView(full)
}

export async function sendMessage(
  tenantId: string,
  userId: string,
  text: string,
): Promise<AssistantView> {
  if (!isAIConfigured()) throw new AssistantUnavailableError()

  const conversation = await getOrCreateConversation(tenantId, userId)
  const existing = await loadWindow(tenantId, conversation)

  const userMessage: TurnMessage = { role: 'user', content: [{ type: 'text', text }] }
  const [storedUser] = await appendMessages(tenantId, conversation.id, [userMessage])

  const history = [...existing, storedUser]
  const options = await runOptions(tenantId, userId, conversation, history)
  const result = await runTurn(options)

  return persistAndView(tenantId, conversation, history, result)
}

export type ResolveOutcome =
  | { status: 'ok'; view: AssistantView }
  | { status: 'not_found' }
  | { status: 'already_resolved' }

// Runs a held write, or records that it was declined. The pending action is
// re-derived from the transcript rather than trusted from the request: the client
// only names a message and a tool_use id, and the arguments are re-validated
// against the tool's schema before the adapter is called.
export async function resolveAction(
  tenantId: string,
  userId: string,
  params: { messageId: string; toolUseId: string; decision: 'confirm' | 'reject' },
): Promise<ResolveOutcome> {
  if (!isAIConfigured()) throw new AssistantUnavailableError()

  const conversation = await getOrCreateConversation(tenantId, userId)
  const window = await loadWindow(tenantId, conversation)

  const index = window.findIndex((message) => message.id === params.messageId)
  if (index === -1) return { status: 'not_found' }

  // The proposal must still be the newest message. Anything after it means a
  // tool_result was already written for this tool_use — the guard against a
  // double tap creating two jobs.
  if (index !== window.length - 1) return { status: 'already_resolved' }

  const message = window[index]
  if (message.role !== 'assistant') return { status: 'not_found' }

  const block = (message.content as { type?: string; id?: string; name?: string; input?: unknown }[])
    .find((b) => b.type === 'tool_use' && b.id === params.toolUseId)
  if (!block?.name) return { status: 'not_found' }

  const spec = findToolSpec(block.name)
  if (!spec || !spec.mutates) return { status: 'not_found' }

  const parsed = spec.schema.safeParse(block.input)
  if (!parsed.success) return { status: 'not_found' }

  const action: PendingAction = {
    toolUseId: params.toolUseId,
    tool: spec.name,
    input: parsed.data,
    summary: (spec.summarize as (input: unknown) => string)(parsed.data),
  }

  const options = await runOptions(tenantId, userId, conversation, window)
  const result =
    params.decision === 'confirm'
      ? await confirmAction(options, action)
      : await rejectAction(options, action)

  const view = await persistAndView(tenantId, conversation, window, result)
  return { status: 'ok', view }
}
