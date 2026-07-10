import { Hono } from 'hono'
import { z } from 'zod'
import { sendBookingConfirmation } from '../lib/email.js'
import {
  createBooking,
  getAvailability,
  getPublicTenant,
} from '../services/booking.service.js'

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

  const booking = await createBooking(tenant, result.data)
  if (!booking) {
    return c.json({ error: 'This date is no longer available, please choose another' }, 409)
  }
  if (booking.clientAlreadyBookedDate) {
    return c.json({ error: 'You already have a booking for this date. We will call you to confirm.' }, 409)
  }

  if (result.data.clientEmail) {
    const moveDate = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${result.data.moveDate}T00:00:00Z`))

    sendBookingConfirmation({
      to: result.data.clientEmail,
      clientName: result.data.clientName,
      companyName: tenant.name,
      companyPhone: tenant.phone,
      moveDate,
      fromAddress: result.data.fromAddress,
      toAddress: result.data.toAddress,
      estimatedPrice: booking.totalPrice,
    })
  }

  return c.json(
    {
      orderId: booking.orderId,
      totalPrice: booking.totalPrice,
      confirmationMessage: `${tenant.name} will be in touch to confirm your move.`,
    },
    201
  )
})

export default bookRouter
