import { Hono } from 'hono'
import { z } from 'zod'
import {
  getPublicContract,
  signContract,
  storeSignedContractPdf,
} from '../services/contract.service.js'

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024

const signSchema = z.object({
  signedName: z.string().trim().min(2),
  signatureDataUrl: z.string().min(1),
})

const contractRouter = new Hono()

contractRouter.get('/:token', async (c) => {
  const contract = await getPublicContract(c.req.param('token'))
  if (!contract) return c.json({ error: 'Contract not found' }, 404)
  return c.json(contract)
})

contractRouter.post('/:token/sign', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = signSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.issues }, 400)
  }

  const signed = await signContract(c.req.param('token'), result.data)
  switch (signed.status) {
    case 'not_found':
      return c.json({ error: 'Contract not found' }, 404)
    case 'already_signed':
      return c.json({ error: 'This contract has already been signed' }, 409)
    case 'invalid_signature':
      return c.json({ error: 'Please provide your signature' }, 400)
    case 'signed':
      return c.json({ success: true, message: 'Contract signed successfully' })
  }
})

contractRouter.post('/:token/pdf', async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ error: 'File required' }, 400)
  if (file.type !== 'application/pdf') return c.json({ error: 'PDF required' }, 400)
  if (file.size > MAX_PDF_SIZE_BYTES) return c.json({ error: 'File too large' }, 400)

  const pdf = Buffer.from(await file.arrayBuffer())
  const result = await storeSignedContractPdf(c.req.param('token'), pdf)
  switch (result) {
    case 'not_found':
      return c.json({ error: 'Contract not found' }, 404)
    case 'not_signed':
      return c.json({ error: 'Contract is not signed' }, 409)
    case 'no_owner':
      return c.json({ error: 'Unable to store contract' }, 500)
    default:
      return c.json({ success: true })
  }
})

export default contractRouter
