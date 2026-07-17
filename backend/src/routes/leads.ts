import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../lib/env.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  convertLeadToOrder,
  createLead,
  findTenantBySlug,
  getLead,
  listLeads,
  markLeadLost,
  updateLead,
} from '../services/leads.service.js'
import type { AppVariables, LeadStatus } from '../types/index.js'

const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'] as const

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  fromAddress: z.string().optional(),
  toAddress: z.string().optional(),
  moveDate: z.string().optional(),
  homeSize: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'phone']).default('manual'),
})

const patchLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  fromAddress: z.string().nullable().optional(),
  toAddress: z.string().nullable().optional(),
  moveDate: z.string().nullable().optional(),
  homeSize: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
})

const listQuerySchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  search: z.string().optional(),
})

const leadsRouter = new Hono<{ Variables: AppVariables }>()

// ─── Public Zapier webhook — NO auth, guarded by ?secret=WEBHOOK_SECRET ───────
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
}

leadsRouter.post('/webhook', async (c) => {
  const secret = c.req.query('secret')
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const tenantSlug = str(body.tenant_slug)
  if (!tenantSlug) return c.json({ error: 'tenant_slug is required' }, 400)

  const name = str(body.name) ?? str(body.full_name) ?? str(body.first_name)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const tenant = await findTenantBySlug(tenantSlug)
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  const lead = await createLead(tenant.id, null, {
    name,
    phone: str(body.phone) ?? str(body.phone_number),
    email: str(body.email) ?? str(body.email_address),
    fromAddress: str(body.from_address) ?? str(body.pickup_address) ?? str(body.from),
    toAddress: str(body.to_address) ?? str(body.delivery_address) ?? str(body.to),
    moveDate: str(body.move_date) ?? str(body.date),
    notes: str(body.notes) ?? str(body.message),
    source: 'zapier',
  })

  return c.json({ success: true, leadId: lead.id })
})

// ─── Authenticated CRUD ───────────────────────────────────────────────────────
leadsRouter.post('/', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = createLeadSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed', details: result.error.issues }, 400)

  const lead = await createLead(c.get('tenantId'), c.get('userId'), result.data)
  return c.json({ lead }, 201)
})

leadsRouter.get('/', authMiddleware, async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Validation failed' }, 400)
  const leads = await listLeads(c.get('tenantId'), {
    status: parsed.data.status as LeadStatus | undefined,
    search: parsed.data.search,
  })
  return c.json({ leads })
})

leadsRouter.get('/:id', authMiddleware, async (c) => {
  const lead = await getLead(c.get('tenantId'), c.req.param('id'))
  if (!lead) return c.json({ error: 'Lead not found' }, 404)
  return c.json({ lead })
})

leadsRouter.patch('/:id', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = patchLeadSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const updated = await updateLead(c.get('tenantId'), c.req.param('id'), result.data)
  if (!updated) return c.json({ error: 'Lead not found' }, 404)
  return c.json({ lead: updated })
})

leadsRouter.delete('/:id', authMiddleware, async (c) => {
  const updated = await markLeadLost(c.get('tenantId'), c.req.param('id'))
  if (!updated) return c.json({ error: 'Lead not found' }, 404)
  return c.json({ lead: updated })
})

leadsRouter.post('/:id/convert', authMiddleware, async (c) => {
  const result = await convertLeadToOrder(c.get('tenantId'), c.get('userId'), c.req.param('id'))
  if (!result) return c.json({ error: 'Lead not found' }, 404)
  return c.json(result)
})

export default leadsRouter
