import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppVariables } from '../types/index.js'

vi.mock('../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: '12345678901234567890123456789012',
    DATABASE_URL: 'postgresql://test',
    RESEND_API_KEY: 're_test_key',
    JWT_EXPIRES_IN: '7d',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    STRIPE_BASIC_PRICE_ID: 'price_basic',
    STRIPE_PRO_PRICE_ID: 'price_pro',
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY_ID: 'test-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://pub.example.com',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}))

const getOrderByIdMock = vi.fn()
vi.mock('../services/orders.service.js', () => ({
  createOrder: vi.fn(),
  findOrCreateClient: vi.fn(),
  getOrderById: (...args: unknown[]) => getOrderByIdMock(...args),
  getTenantBaseRates: vi.fn(),
  isValidTransition: vi.fn(),
  listOrders: vi.fn(),
  updateOrder: vi.fn(),
}))

const countOrderFilesMock = vi.fn()
const listOrderFilesMock = vi.fn()
const createOrderFileRecordMock = vi.fn()
const getOrderFileByIdMock = vi.fn()
const deleteOrderFileRecordMock = vi.fn()

vi.mock('../services/files.service.js', () => ({
  MAX_FILES_PER_ORDER: 20,
  countOrderFiles: (...args: unknown[]) => countOrderFilesMock(...args),
  listOrderFiles: (...args: unknown[]) => listOrderFilesMock(...args),
  createOrderFileRecord: (...args: unknown[]) => createOrderFileRecordMock(...args),
  getOrderFileById: (...args: unknown[]) => getOrderFileByIdMock(...args),
  deleteOrderFileRecord: (...args: unknown[]) => deleteOrderFileRecordMock(...args),
}))

const uploadOrderFileMock = vi.fn()
const deleteOrderFileMock = vi.fn()

vi.mock('../lib/r2.js', () => ({
  uploadOrderFile: (...args: unknown[]) => uploadOrderFileMock(...args),
  deleteOrderFile: (...args: unknown[]) => deleteOrderFileMock(...args),
}))

const { default: ordersRouter } = await import('./orders.js')
const { signToken } = await import('../lib/jwt.js')

const app = new Hono<{ Variables: AppVariables }>().route('/orders', ordersRouter)

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '22222222-2222-2222-2222-222222222222'
const ORDER_ID = '33333333-3333-3333-3333-333333333333'
const FILE_ID = '44444444-4444-4444-4444-444444444444'

async function authCookie(tenantId = TENANT_A): Promise<string> {
  const token = await signToken({ sub: 'user-1', tenantId, role: 'owner', plan: 'trial' })
  return `token=${token}`
}

const order = { id: ORDER_ID, tenant_id: TENANT_A, status: 'new' }

beforeEach(() => {
  getOrderByIdMock.mockReset()
  countOrderFilesMock.mockReset()
  listOrderFilesMock.mockReset()
  createOrderFileRecordMock.mockReset()
  getOrderFileByIdMock.mockReset()
  deleteOrderFileRecordMock.mockReset()
  uploadOrderFileMock.mockReset()
  deleteOrderFileMock.mockReset()
})

describe('GET /orders/:id/files', () => {
  it('returns the files array — happy path', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    const files = [{ id: FILE_ID, name: 'inventory.pdf', url: 'https://pub.example.com/x.pdf' }]
    listOrderFilesMock.mockResolvedValue(files)

    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { files: typeof files }
    expect(body.files).toEqual(files)
    expect(listOrderFilesMock).toHaveBeenCalledWith(TENANT_A, ORDER_ID)
  })

  it('returns 404 when order not found for tenant', async () => {
    getOrderByIdMock.mockResolvedValue(null)

    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(404)
    expect(listOrderFilesMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request(`/orders/${ORDER_ID}/files`)
    expect(res.status).toBe(401)
    expect(getOrderByIdMock).not.toHaveBeenCalled()
  })
})

describe('POST /orders/:id/files', () => {
  function buildForm(file: File): FormData {
    const form = new FormData()
    form.set('file', file)
    return form
  }

  it('uploads a valid jpeg and returns 201 — happy path', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    countOrderFilesMock.mockResolvedValue(0)
    uploadOrderFileMock.mockResolvedValue({
      url: 'https://pub.example.com/a.jpg',
      key: `${TENANT_A}/${ORDER_ID}/uuid.jpg`,
    })
    const created = { id: FILE_ID, name: 'photo.jpg', url: 'https://pub.example.com/a.jpg' }
    createOrderFileRecordMock.mockResolvedValue(created)

    const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie() },
      body: buildForm(file),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { file: typeof created }
    expect(body.file).toEqual(created)
    expect(uploadOrderFileMock).toHaveBeenCalledWith(expect.any(File), TENANT_A, ORDER_ID)
    expect(createOrderFileRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, orderId: ORDER_ID, name: 'photo.jpg', mimeType: 'image/jpeg' }),
    )
  })

  it('rejects a file over 10MB with 400 (AC7)', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    countOrderFilesMock.mockResolvedValue(0)

    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })

    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie() },
      body: buildForm(oversized),
    })

    expect(res.status).toBe(400)
    expect(uploadOrderFileMock).not.toHaveBeenCalled()
  })

  it('rejects a disallowed MIME type with 400 (AC8)', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    countOrderFilesMock.mockResolvedValue(0)

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie() },
      body: buildForm(file),
    })

    expect(res.status).toBe(400)
    expect(uploadOrderFileMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the file field is missing', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    countOrderFilesMock.mockResolvedValue(0)

    const form = new FormData()
    form.set('description', 'no file here')

    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie() },
      body: form,
    })

    expect(res.status).toBe(400)
    expect(uploadOrderFileMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the order already has 20 files', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    countOrderFilesMock.mockResolvedValue(20)

    const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie() },
      body: buildForm(file),
    })

    expect(res.status).toBe(409)
    expect(uploadOrderFileMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the order belongs to a different tenant (AC9 tenant isolation)', async () => {
    getOrderByIdMock.mockResolvedValue(null)

    const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      headers: { Cookie: await authCookie(TENANT_B) },
      body: buildForm(file),
    })

    expect(res.status).toBe(404)
    expect(getOrderByIdMock).toHaveBeenCalledWith(TENANT_B, ORDER_ID)
    expect(uploadOrderFileMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
    const res = await app.request(`/orders/${ORDER_ID}/files`, {
      method: 'POST',
      body: buildForm(file),
    })
    expect(res.status).toBe(401)
    expect(getOrderByIdMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /orders/:id/files/:fileId', () => {
  it('deletes from R2 and DB, returns 200 — happy path', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    const file = { id: FILE_ID, key: `${TENANT_A}/${ORDER_ID}/uuid.jpg` }
    getOrderFileByIdMock.mockResolvedValue(file)
    deleteOrderFileMock.mockResolvedValue(undefined)
    deleteOrderFileRecordMock.mockResolvedValue(true)

    const res = await app.request(`/orders/${ORDER_ID}/files/${FILE_ID}`, {
      method: 'DELETE',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(200)
    expect(deleteOrderFileMock).toHaveBeenCalledWith(file.key)
    expect(deleteOrderFileRecordMock).toHaveBeenCalledWith(TENANT_A, ORDER_ID, FILE_ID)
  })

  it('returns 404 when the file is not found for that tenant/order (tenant isolation)', async () => {
    getOrderByIdMock.mockResolvedValue(order)
    getOrderFileByIdMock.mockResolvedValue(null)

    const res = await app.request(`/orders/${ORDER_ID}/files/${FILE_ID}`, {
      method: 'DELETE',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(404)
    expect(deleteOrderFileMock).not.toHaveBeenCalled()
    expect(deleteOrderFileRecordMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is not found', async () => {
    getOrderByIdMock.mockResolvedValue(null)

    const res = await app.request(`/orders/${ORDER_ID}/files/${FILE_ID}`, {
      method: 'DELETE',
      headers: { Cookie: await authCookie() },
    })

    expect(res.status).toBe(404)
    expect(getOrderFileByIdMock).not.toHaveBeenCalled()
    expect(deleteOrderFileMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no auth cookie with 401', async () => {
    const res = await app.request(`/orders/${ORDER_ID}/files/${FILE_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(401)
    expect(getOrderByIdMock).not.toHaveBeenCalled()
  })
})
