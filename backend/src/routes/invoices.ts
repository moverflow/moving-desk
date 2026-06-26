import { Hono } from 'hono'
import { z } from 'zod'
import { sendInvoiceEmail } from '../lib/email.js'
import { authMiddleware } from '../middleware/auth.js'
import { updateClient } from '../services/clients.service.js'
import {
  generateInvoice,
  getInvoiceById,
  getInvoiceSendData,
  getPublicInvoice,
  listInvoices,
  markInvoiceSent,
  updateInvoiceStatus,
} from '../services/invoices.service.js'
import type { AppVariables } from '../types/index.js'

const createInvoiceSchema = z.object({ orderId: z.string().uuid() })

const statusSchema = z.object({ status: z.enum(['sent', 'paid']) })

const sendInvoiceSchema = z.object({
  email: z.string().email().optional(),
})

const invoicesRouter = new Hono<{ Variables: AppVariables }>()

// PUBLIC — must be registered before /:id
invoicesRouter.get('/share/:token', async (c) => {
  const data = await getPublicInvoice(c.req.param('token'))
  if (!data) return c.json({ error: 'Invoice not found or expired' }, 404)
  return c.json({ invoice: data })
})

invoicesRouter.get('/', authMiddleware, async (c) => {
  const list = await listInvoices(c.get('tenantId'))
  return c.json({ invoices: list })
})

invoicesRouter.post('/', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = createInvoiceSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  const invoice = await generateInvoice(c.get('tenantId'), result.data.orderId)
  if (!invoice) return c.json({ error: 'Order not found' }, 404)
  return c.json({ invoice }, 201)
})

invoicesRouter.get('/:id', authMiddleware, async (c) => {
  const invoice = await getInvoiceById(c.get('tenantId'), c.req.param('id'))
  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  return c.json({ invoice })
})

invoicesRouter.patch('/:id/status', authMiddleware, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = statusSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const updated = await updateInvoiceStatus(
    c.get('tenantId'),
    c.req.param('id'),
    result.data.status
  )
  if (!updated) return c.json({ error: 'Invoice not found' }, 404)
  return c.json({ invoice: updated })
})

invoicesRouter.post('/:id/send', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId')
  const invoiceId = c.req.param('id')

  let body: unknown = {}
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }
  const parsed = sendInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400)
  }

  const data = await getInvoiceSendData(tenantId, invoiceId)
  if (!data) return c.json({ error: 'Invoice not found' }, 404)

  const email = parsed.data.email ?? data.clientEmail ?? null
  if (!email) {
    return c.json({ error: 'Client has no email address. Add an email to send the invoice.' }, 422)
  }

  if (parsed.data.email && data.clientId && !data.clientEmail) {
    await updateClient(tenantId, data.clientId, { email: parsed.data.email })
  }

  sendInvoiceEmail({
    to: email,
    clientName: data.clientName ?? 'Client',
    companyName: data.companyName,
    invoiceNumber: data.number,
    shareToken: data.share_token ?? '',
  })

  if (data.status !== 'paid') {
    await markInvoiceSent(tenantId, invoiceId)
  }

  return c.json({ message: 'Invoice sent' })
})

export default invoicesRouter
