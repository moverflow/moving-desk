import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

const getPublicContractMock = vi.fn()
const signContractMock = vi.fn()
const storeSignedContractPdfMock = vi.fn()

vi.mock('../services/contract.service.js', () => ({
  getPublicContract: (...a: unknown[]) => getPublicContractMock(...a),
  signContract: (...a: unknown[]) => signContractMock(...a),
  storeSignedContractPdf: (...a: unknown[]) => storeSignedContractPdfMock(...a),
}))

const { default: contractRouter } = await import('./contract.js')

const app = new Hono().route('/contract', contractRouter)

const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const PUBLIC_CONTRACT = {
  order: {
    moveDate: 'Jun 15, 2026',
    fromAddress: 'Lake Forest, CA 92630',
    toAddress: 'Anaheim, CA 92801',
    homeSize: '2 BR',
    packing: true,
    totalPrice: 600,
    fromFloor: 1,
    toFloor: 2,
    fromElevator: false,
    toElevator: true,
  },
  client: { name: 'Rick Adams', phone: '(949) 632-9557' },
  company: { name: 'Best Movers', logoUrl: null, phone: '(714) 555-0199', contractTerms: null },
  contractStatus: 'sent',
  alreadySigned: false,
  signedName: null,
  signedAt: null,
}

beforeEach(() => {
  getPublicContractMock.mockReset()
  signContractMock.mockReset()
  storeSignedContractPdfMock.mockReset()
})

describe('GET /contract/:token', () => {
  it('AC4 — returns contract data with no auth cookie required (AC18)', async () => {
    getPublicContractMock.mockResolvedValue(PUBLIC_CONTRACT)
    const res = await app.request(`/contract/${TOKEN}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as typeof PUBLIC_CONTRACT & Record<string, unknown>
    expect(body).toEqual(PUBLIC_CONTRACT)
    // AC19 — no internal identifiers leak in the public payload
    expect(JSON.stringify(body)).not.toContain('tenantId')
    expect(JSON.stringify(body)).not.toContain('tenant_id')
    expect(getPublicContractMock).toHaveBeenCalledWith(TOKEN)
  })

  it('returns 404 when the token is unknown', async () => {
    getPublicContractMock.mockResolvedValue(null)
    const res = await app.request(`/contract/${TOKEN}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /contract/:token/sign', () => {
  async function sign(body: unknown): Promise<Response> {
    return app.request(`/contract/${TOKEN}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('AC9 — signs successfully and returns success message', async () => {
    signContractMock.mockResolvedValue({ status: 'signed', orderId: 'o1', tenantId: 't1' })
    const res = await sign({ signedName: 'Rick Adams', signatureDataUrl: 'data:image/png;base64,AAA' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Contract signed successfully' })
    expect(signContractMock).toHaveBeenCalledWith(TOKEN, {
      signedName: 'Rick Adams',
      signatureDataUrl: 'data:image/png;base64,AAA',
    })
  })

  it('AC7 — rejects a name shorter than 2 chars with 400', async () => {
    const res = await sign({ signedName: 'R', signatureDataUrl: 'data:image/png;base64,AAA' })
    expect(res.status).toBe(400)
    expect(signContractMock).not.toHaveBeenCalled()
  })

  it('AC8 — maps invalid signature to a 400 error', async () => {
    signContractMock.mockResolvedValue({ status: 'invalid_signature' })
    const res = await sign({ signedName: 'Rick Adams', signatureDataUrl: 'not-a-data-url' })
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toContain('signature')
  })

  it('AC13 — returns 409 when the contract is already signed', async () => {
    signContractMock.mockResolvedValue({ status: 'already_signed' })
    const res = await sign({ signedName: 'Rick Adams', signatureDataUrl: 'data:image/png;base64,AAA' })
    expect(res.status).toBe(409)
  })

  it('returns 404 when the token is unknown', async () => {
    signContractMock.mockResolvedValue({ status: 'not_found' })
    const res = await sign({ signedName: 'Rick Adams', signatureDataUrl: 'data:image/png;base64,AAA' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed JSON body', async () => {
    const res = await app.request(`/contract/${TOKEN}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /contract/:token/pdf', () => {
  it('AC11 — stores an uploaded signed-contract PDF', async () => {
    storeSignedContractPdfMock.mockResolvedValue('stored')
    const form = new FormData()
    form.set('file', new File([new Uint8Array(20)], 'contract.pdf', { type: 'application/pdf' }))
    const res = await app.request(`/contract/${TOKEN}/pdf`, { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(storeSignedContractPdfMock).toHaveBeenCalledWith(TOKEN, expect.any(Buffer))
  })

  it('rejects a non-PDF upload with 400', async () => {
    const form = new FormData()
    form.set('file', new File(['x'], 'note.txt', { type: 'text/plain' }))
    const res = await app.request(`/contract/${TOKEN}/pdf`, { method: 'POST', body: form })
    expect(res.status).toBe(400)
    expect(storeSignedContractPdfMock).not.toHaveBeenCalled()
  })
})
