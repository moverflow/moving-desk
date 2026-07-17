import { Hono } from 'hono'
import { z } from 'zod'
import { getAvailability, getPublicTenant } from '../services/booking.service.js'
import { createLead } from '../services/leads.service.js'

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)

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

bookRouter.post('/:slug', async (c) => {
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
