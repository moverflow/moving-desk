import { z } from 'zod'

// The assistant's view of a backend. Nothing in this file knows that MovingDesk
// exists: the AI layer (system prompt, tool-calling loop, context management)
// imports only from here, and a different product would satisfy the same
// interface with its own adapter. See movingdesk.adapter.ts for the one that
// does exist.

export const HOME_SIZES = ['studio', '1br', '2br', '3br', 'house'] as const
export type HomeSize = (typeof HOME_SIZES)[number]

// Deliberately a subset of the statuses a backend may hold internally: these are
// the transitions a dispatcher asks for out loud. `new` is absent because a job
// is created in it and never moves back to it.
export const JOB_STATUSES = [
  'confirmed',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

// ─── Generic outputs ──────────────────────────────────────────────────────────
// Plain data, in the units and shapes the assistant reasons about: whole dollars
// (never cents), ISO dates (never Date objects), and no foreign keys the user
// cannot see. An adapter is responsible for the translation.

export interface JobSummary {
  id: string
  reference: string
  status: string
  moveDate: string
  fromAddress: string
  toAddress: string
  homeSize: string
  packing: boolean
  totalPrice: number
  clientName: string | null
  clientPhone: string | null
  crewName: string | null
}

export interface InvoiceSummary {
  id: string
  number: string
  status: string
  totalPrice: number
  moveDate: string
  clientName: string | null
  clientPhone: string | null
  sentAt: string | null
  dueLabel: string
}

export interface ClientSummary {
  id: string
  name: string
  phone: string | null
  email: string | null
  jobCount: number
}

// ─── Tool inputs ──────────────────────────────────────────────────────────────
// Zod is the single source of truth: it validates whatever the model produces
// AND generates the JSON Schema the model is shown, so the two cannot drift.

export const listUpcomingJobsInput = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .default(7)
    .describe('How many days ahead to look, counting today. Defaults to 7.'),
  status: z
    .enum(JOB_STATUSES)
    .optional()
    .describe('Only return jobs in this status. Omit for every status.'),
})

export const listUnpaidInvoicesInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of invoices to return. Defaults to 20.'),
})

export const findClientInput = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe('Part of the client name, or their phone number in any format.'),
})

export const createJobInput = z.object({
  clientName: z.string().min(2).max(255).describe('Full name of the client.'),
  clientPhone: z
    .string()
    .min(7)
    .max(20)
    .describe('Client phone number. Any format the user gives; digits are what matter.'),
  clientEmail: z
    .string()
    .email()
    .optional()
    .describe('Client email, if the user mentioned one. Needed to email a contract later.'),
  moveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Move date as YYYY-MM-DD.'),
  fromAddress: z.string().min(3).max(500).describe('Pickup address.'),
  toAddress: z.string().min(3).max(500).describe('Delivery address.'),
  homeSize: z
    .enum(HOME_SIZES)
    .describe('Size of the home being moved. Drives the base price.'),
  packing: z
    .boolean()
    .default(false)
    .describe('Whether the crew is packing for the client. Adds the packing fee.'),
  fromFloor: z.number().int().min(0).max(100).default(1).describe('Floor at the pickup address.'),
  toFloor: z.number().int().min(0).max(100).default(1).describe('Floor at the delivery address.'),
  fromElevator: z.boolean().default(false).describe('Elevator available at pickup.'),
  toElevator: z.boolean().default(false).describe('Elevator available at delivery.'),
  notes: z.string().max(2000).optional().describe('Anything else the crew should know.'),
})

export const setJobStatusInput = z.object({
  jobId: z.string().uuid().describe('Id of the job, as returned by another tool.'),
  status: z.enum(JOB_STATUSES).describe('Status to move the job to.'),
})

export type ListUpcomingJobsInput = z.output<typeof listUpcomingJobsInput>
export type ListUnpaidInvoicesInput = z.output<typeof listUnpaidInvoicesInput>
export type FindClientInput = z.output<typeof findClientInput>
export type CreateJobInput = z.output<typeof createJobInput>
export type SetJobStatusInput = z.output<typeof setJobStatusInput>

// ─── The backend interface ────────────────────────────────────────────────────

export interface AssistantBackend {
  listUpcomingJobs(input: ListUpcomingJobsInput): Promise<JobSummary[]>
  listUnpaidInvoices(input: ListUnpaidInvoicesInput): Promise<InvoiceSummary[]>
  findClient(input: FindClientInput): Promise<ClientSummary[]>
  createJob(input: CreateJobInput): Promise<JobSummary>
  setJobStatus(input: SetJobStatusInput): Promise<JobSummary>
}

// ─── Tool registry ────────────────────────────────────────────────────────────

export type ToolName = keyof AssistantBackend

export interface ToolSpec {
  name: ToolName
  description: string
  schema: z.ZodType
  // Whether calling this changes data. The orchestrator refuses to run a
  // mutating tool without an explicit user confirmation, so this flag is the
  // whole confirmation gate — a new write tool is gated by declaring it here.
  mutates: boolean
  // One line shown to the user on the confirm button, built from the validated
  // input. Deliberately plain text: the Mini App renders it as-is.
  summarize: (input: never) => string
}

function spec<S extends z.ZodType>(
  s: Omit<ToolSpec, 'schema' | 'summarize'> & {
    schema: S
    summarize: (input: z.output<S>) => string
  },
): ToolSpec {
  return s as unknown as ToolSpec
}

export const TOOL_SPECS: readonly ToolSpec[] = [
  spec({
    name: 'listUpcomingJobs',
    description:
      'List jobs scheduled in the next N days, soonest first. Use for "what is on today", ' +
      '"what does this week look like", or to find a job the user is describing by date.',
    schema: listUpcomingJobsInput,
    mutates: false,
    summarize: (i) => `List jobs for the next ${i.days} days`,
  }),
  spec({
    name: 'listUnpaidInvoices',
    description:
      'List invoices that have been issued but not paid, oldest first. Use for "who owes us ' +
      'money", "which invoices are unpaid", or chasing overdue payments.',
    schema: listUnpaidInvoicesInput,
    mutates: false,
    summarize: (i) => `List up to ${i.limit} unpaid invoices`,
  }),
  spec({
    name: 'findClient',
    description:
      'Look up clients by name or phone number. Use before creating a job to check whether ' +
      'the client already exists, or to answer questions about a specific customer.',
    schema: findClientInput,
    mutates: false,
    summarize: (i) => `Look up clients matching "${i.query}"`,
  }),
  spec({
    name: 'createJob',
    description:
      'Create a new job. The price is calculated by the backend from the home size and ' +
      'packing choice — never ask the user for a price or invent one. Ask for anything you ' +
      'are missing before calling this; do not guess an address or a date.',
    schema: createJobInput,
    mutates: true,
    summarize: (i) =>
      `Create a job for ${i.clientName} on ${i.moveDate}: ${i.fromAddress} → ${i.toAddress}`,
  }),
  spec({
    name: 'setJobStatus',
    description:
      'Move an existing job to a new status. Call listUpcomingJobs or findClient first to get ' +
      'the job id — never guess one.',
    schema: setJobStatusInput,
    mutates: true,
    summarize: (i) => `Change job status to "${i.status}"`,
  }),
]

const SPECS_BY_NAME = new Map<string, ToolSpec>(TOOL_SPECS.map((s) => [s.name, s]))

export function findToolSpec(name: string): ToolSpec | null {
  return SPECS_BY_NAME.get(name) ?? null
}

// A tool failure the model is allowed to see and retry around — "no job with
// that id", "that status change is not allowed". Anything else thrown by an
// adapter is a bug and must not be described to the model.
export class ToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolError'
  }
}
