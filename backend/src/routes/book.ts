import { Hono } from 'hono'
import { z } from 'zod'
import { rateLimit } from '../middleware/rateLimit.js'
import { getAvailability, getPublicTenant } from '../services/booking.service.js'
import { createLead } from '../services/leads.service.js'

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)

// A real person books one move, occasionally two. Anything past this from one
// address is scripted — and every lead also emails the owner a follow-up
// reminder, so an unbounded endpoint is an amplification vector.
const bookingRateLimit = rateLimit({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many booking requests. Please try again later, or call us directly.',
})

// Humans need seconds to fill this form; bots post immediately.
const MIN_FILL_MS = 3000

const bookingSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(1),
  clientEmail: z.string().email().optional(),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  moveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  homeSize: z.enum(['studio', '1br', '2br', '3br', 'house']),
  fromFloor: z.number().int().min(0).default(1),
  toFloor: z.number().int().min(0).default(1),
  fromElevator: z.boolean().default(false),
  toElevator: z.boolean().default(false),
  packing: z.boolean().default(false),
  notes: z.string().optional(),
  // Honeypot: rendered hidden, so a real user never fills it in.
  website: z.string().optional(),
  // Milliseconds between the form rendering and submission, reported by the
  // client. Spoofable by a determined bot, which is fine — this is cheap
  // filtering for commodity spam, layered under the rate limit above.
  elapsedMs: z.number().int().nonnegative().optional(),
})

const bookRouter = new Hono()

bookRouter.get('/:slug', async (c) => {
  const tenant = await getPublicTenant(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Not found' }, 404)
  return c.json({
    tenant: {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      phone: tenant.phone,
      description: tenant.description,
      slug: tenant.slug,
      baseRates: tenant.baseRates,
      packingFee: tenant.packingFee,
    },
  })
})

bookRouter.get('/:slug/availability', async (c) => {
  const tenant = await getPublicTenant(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Not found' }, 404)

  const month = monthSchema.safeParse(c.req.query('month'))
  if (!month.success) return c.json({ error: 'Invalid month, expected YYYY-MM' }, 400)

  const availableDates = await getAvailability(tenant.id, month.data)
  return c.json({ availableDates })
})

bookRouter.post('/:slug', bookingRateLimit, async (c) => {
  const tenant = await getPublicTenant(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Not found' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = bookingSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  // Lead capture: booking-page submissions land in the dispatcher's pipeline as
  // a lead (not an auto-confirmed order). The dispatcher reviews and converts.
  const d = result.data

  // Rejected rather than silently discarded: browser autofill can occasionally
  // populate a hidden field, and a real customer who trips this must find out
  // now instead of believing their move is booked.
  const trippedHoneypot = d.website !== undefined && d.website.trim().length > 0
  const submittedTooFast = d.elapsedMs !== undefined && d.elapsedMs < MIN_FILL_MS
  if (trippedHoneypot || submittedTooFast) {
    return c.json({ error: 'Could not submit this form. Please try again.' }, 400)
  }

  const lead = await createLead(tenant.id, null, {
    name: d.clientName,
    phone: d.clientPhone,
    email: d.clientEmail,
    fromAddress: d.fromAddress,
    toAddress: d.toAddress,
    moveDate: d.moveDate,
    homeSize: d.homeSize,
    notes: d.notes,
    source: 'booking_page',
  })

  return c.json(
    {
      success: true,
      leadId: lead.id,
      confirmationMessage: `Thank you, ${d.clientName}. ${tenant.name} will be in touch within 1 business day.`,
    },
    201
  )
})

export default bookRouter
