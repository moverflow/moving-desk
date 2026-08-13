import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, crews, invoices, orders } from '../db/schema.js'
import { addDays, getTenantToday } from '../lib/timezone.js'
import {
  createOrder,
  findOrCreateClient,
  getOrderById,
  isValidTransition,
  sendOrderCompletedEmail,
  updateOrder,
} from '../services/orders.service.js'
import { sendContractForOrder } from '../services/contract.service.js'
import { getTenantPricing, getTenantTimezone } from '../services/settings.service.js'
import type {
  AssistantBackend,
  ClientSummary,
  CreateJobInput,
  FindClientInput,
  InvoiceSummary,
  JobSummary,
  ListUnpaidInvoicesInput,
  ListUpcomingJobsInput,
  SetJobStatusInput,
} from './contract.js'
import { ToolError } from './contract.js'

// Statuses that mean "issued, money still outstanding". `draft` is excluded: it
// has not been sent, so nobody owes anything yet.
const UNPAID_STATUSES = ['sent', 'disputed'] as const

// Orders keep no human-facing reference number, so the assistant quotes the id's
// first block — enough for the user to match a card to a row on the board.
function jobReference(id: string): string {
  return `#${id.slice(0, 8)}`
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

interface OrderRow {
  id: string
  status: string
  move_date: string
  from_address: string
  to_address: string
  home_size: string
  packing: boolean | null
  total_price: number
  clientName: string | null
  clientPhone: string | null
  crewName: string | null
}

function toJobSummary(row: OrderRow): JobSummary {
  return {
    id: row.id,
    reference: jobReference(row.id),
    status: row.status,
    moveDate: row.move_date,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    homeSize: row.home_size,
    packing: row.packing ?? false,
    totalPrice: row.total_price,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    crewName: row.crewName,
  }
}

const jobFields = {
  id: orders.id,
  status: orders.status,
  move_date: orders.move_date,
  from_address: orders.from_address,
  to_address: orders.to_address,
  home_size: orders.home_size,
  packing: orders.packing,
  total_price: orders.total_price,
  clientName: clients.name,
  clientPhone: clients.phone,
  crewName: crews.name,
}

// Satisfies the assistant's abstract tool contract by calling MovingDesk's own
// services. One instance per turn, bound to the caller's tenant and user — every
// query below filters on `this.tenantId`, which is where multi-tenancy is
// enforced for the whole assistant: the model never sees or supplies a tenant id.
export class MovingDeskAdapter implements AssistantBackend {
  constructor(
    private readonly tenantId: string,
    private readonly userId: string,
  ) {}

  async listUpcomingJobs(input: ListUpcomingJobsInput): Promise<JobSummary[]> {
    const timezone = await getTenantTimezone(this.tenantId)
    const today = getTenantToday(timezone)
    const until = addDays(today, input.days - 1)

    const rows = await db
      .select(jobFields)
      .from(orders)
      .leftJoin(clients, eq(clients.id, orders.client_id))
      .leftJoin(crews, eq(crews.id, orders.crew_id))
      .where(
        and(
          eq(orders.tenant_id, this.tenantId),
          gte(orders.move_date, today),
          lte(orders.move_date, until),
          input.status ? eq(orders.status, input.status) : undefined,
        ),
      )
      .orderBy(asc(orders.move_date))

    return rows.map(toJobSummary)
  }

  async listUnpaidInvoices(input: ListUnpaidInvoicesInput): Promise<InvoiceSummary[]> {
    const rows = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        sent_at: invoices.sent_at,
        move_date: orders.move_date,
        total_price: orders.total_price,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(invoices)
      .innerJoin(orders, eq(orders.id, invoices.order_id))
      .leftJoin(clients, eq(clients.id, orders.client_id))
      .where(
        and(
          eq(invoices.tenant_id, this.tenantId),
          inArray(invoices.status, [...UNPAID_STATUSES]),
        ),
      )
      .orderBy(asc(invoices.created_at))
      .limit(input.limit)

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      totalPrice: row.total_price,
      moveDate: row.move_date,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      sentAt: row.sent_at ? row.sent_at.toISOString() : null,
      dueLabel: row.sent_at ? `Sent ${formatDate(row.sent_at.toISOString().slice(0, 10))}` : 'Not sent',
    }))
  }

  async findClient(input: FindClientInput): Promise<ClientSummary[]> {
    // Phone numbers are stored formatted ("(949) 555-0100") but users type them
    // however they like, so both sides are reduced to digits before comparing.
    const digits = input.query.replace(/\D/g, '')

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        jobCount: sql<number>`cast(count(${orders.id}) as int)`,
      })
      .from(clients)
      .leftJoin(
        orders,
        and(eq(orders.client_id, clients.id), eq(orders.tenant_id, this.tenantId)),
      )
      .where(
        and(
          eq(clients.tenant_id, this.tenantId),
          or(
            sql`${clients.name} ilike ${'%' + input.query + '%'}`,
            digits.length >= 4
              ? sql`regexp_replace(coalesce(${clients.phone}, ''), '\\D', '', 'g') like ${'%' + digits + '%'}`
              : undefined,
          ),
        ),
      )
      .groupBy(clients.id, clients.name, clients.phone, clients.email)
      .orderBy(asc(clients.name))
      .limit(10)

    return rows
  }

  async createJob(input: CreateJobInput): Promise<JobSummary> {
    const clientId = await findOrCreateClient(
      this.tenantId,
      input.clientPhone,
      input.clientName,
      input.clientEmail,
    )

    // Same pricing path as POST /orders — the model is never trusted with a
    // price, and never asked for one.
    const { baseRates, packingFee } = await getTenantPricing(this.tenantId)
    const basePrice = baseRates[input.homeSize] ?? 0
    const totalPrice = basePrice + (input.packing ? packingFee : 0)

    const order = await createOrder({
      tenantId: this.tenantId,
      clientId,
      createdBy: this.userId,
      moveDate: input.moveDate,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      fromFloor: input.fromFloor,
      toFloor: input.toFloor,
      fromElevator: input.fromElevator,
      toElevator: input.toElevator,
      homeSize: input.homeSize,
      packing: input.packing,
      notes: input.notes,
      basePrice,
      totalPrice,
    })

    const created = await this.requireJob(order.id)
    return created
  }

  async setJobStatus(input: SetJobStatusInput): Promise<JobSummary> {
    const existing = await getOrderById(this.tenantId, input.jobId)
    if (!existing) {
      throw new ToolError(`No job found with id ${input.jobId} for this company.`)
    }

    if (existing.status === input.status) {
      throw new ToolError(`That job is already "${input.status}".`)
    }

    if (!isValidTransition(existing.status, input.status)) {
      throw new ToolError(
        `A job cannot go from "${existing.status}" to "${input.status}". ` +
          'Allowed order: new → confirmed → in_progress → completed → closed, ' +
          'and any status → cancelled.',
      )
    }

    const updated = await updateOrder(this.tenantId, input.jobId, { status: input.status })
    if (!updated) {
      throw new ToolError(`No job found with id ${input.jobId} for this company.`)
    }

    // The same side effects PATCH /orders/:id triggers, so a status change made
    // through the assistant is not a second-class one. Both swallow their own
    // failures, so neither can fail the tool call.
    if (input.status === 'confirmed') {
      await sendContractForOrder(this.tenantId, input.jobId)
    }
    if (input.status === 'completed') {
      await sendOrderCompletedEmail(this.tenantId, input.jobId)
    }

    return this.requireJob(input.jobId)
  }

  private async requireJob(orderId: string): Promise<JobSummary> {
    const rows = await db
      .select(jobFields)
      .from(orders)
      .leftJoin(clients, eq(clients.id, orders.client_id))
      .leftJoin(crews, eq(crews.id, orders.crew_id))
      .where(and(eq(orders.id, orderId), eq(orders.tenant_id, this.tenantId)))
      .limit(1)

    const row = rows[0]
    if (!row) throw new ToolError(`No job found with id ${orderId} for this company.`)
    return toJobSummary(row)
  }
}
