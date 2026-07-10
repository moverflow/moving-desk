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
    JWT_EXPIRES_IN: '7d',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

const getPublicTenantMock = vi.fn()
const getAvailabilityMock = vi.fn()
const createBookingMock = vi.fn()
vi.mock('../services/booking.service.js', () => ({
  getPublicTenant: (...a: unknown[]) => getPublicTenantMock(...a),
  getAvailability: (...a: unknown[]) => getAvailabilityMock(...a),
  createBooking: (...a: unknown[]) => createBookingMock(...a),
}))

const sendBookingConfirmationMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendBookingConfirmation: (...a: unknown[]) => sendBookingConfirmationMock(...a),
}))

const { default: bookRouter } = await import('./book.js')
const app = new Hono().route('/book', bookRouter)

const TENANT = {
  id: 'tenant-secret-uuid',
  name: 'Best Movers LLC',
  logoUrl: null,
  phone: '(949) 555-0100',
  description: 'Family owned since 2010',
  slug: 'best-movers-llc',
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
  packingFee: 120,
}

const validBooking = {
  clientName: 'Jane Client',
  clientPhone: '(714) 555-0199',
  clientEmail: 'jane@example.com',
  fromAddress: 'Lake Forest, CA',
  toAddress: 'Anaheim, CA',
  moveDate: '2026-07-15',
  homeSize: '2br',
}

beforeEach(() => {
  getPublicTenantMock.mockReset()
  getAvailabilityMock.mockReset()
  createBookingMock.mockReset()
  sendBookingConfirmationMock.mockReset()
})

describe('GET /book/:slug', () => {
  it('returns public tenant data without exposing internal ids', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    const res = await app.request('/book/best-movers-llc')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tenant: Record<string, unknown> }
    expect(body.tenant.name).toBe('Best Movers LLC')
    expect(body.tenant.slug).toBe('best-movers-llc')
    expect(body.tenant).not.toHaveProperty('id')
    expect(JSON.stringify(body)).not.toContain('tenant-secret-uuid')
  })

  it('returns 404 when booking disabled or tenant missing', async () => {
    getPublicTenantMock.mockResolvedValue(null)
    const res = await app.request('/book/nope')
    expect(res.status).toBe(404)
  })

  it('does not require an auth cookie (fully public)', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    const res = await app.request('/book/best-movers-llc')
    expect(res.status).not.toBe(401)
  })
})

describe('GET /book/:slug/availability', () => {
  it('returns available dates for a valid month', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    getAvailabilityMock.mockResolvedValue(['2026-07-15', '2026-07-16'])
    const res = await app.request('/book/best-movers-llc/availability?month=2026-07')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { availableDates: string[] }
    expect(body.availableDates).toEqual(['2026-07-15', '2026-07-16'])
    expect(getAvailabilityMock).toHaveBeenCalledWith(TENANT.id, '2026-07')
  })

  it('returns 400 for an invalid month format', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    const res = await app.request('/book/best-movers-llc/availability?month=july')
    expect(res.status).toBe(400)
    expect(getAvailabilityMock).not.toHaveBeenCalled()
  })

  it('returns 404 when tenant not found', async () => {
    getPublicTenantMock.mockResolvedValue(null)
    const res = await app.request('/book/x/availability?month=2026-07')
    expect(res.status).toBe(404)
  })
})

describe('POST /book/:slug', () => {
  it('creates an order and sends a confirmation email — happy path', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createBookingMock.mockResolvedValue({
      orderId: 'order-123',
      totalPrice: 480,
      clientAlreadyBookedDate: false,
    })

    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { orderId: string; confirmationMessage: string }
    expect(body.orderId).toBe('order-123')
    expect(body.confirmationMessage).toContain('Best Movers LLC')
    expect(sendBookingConfirmationMock).toHaveBeenCalledOnce()
  })

  it('skips email when no clientEmail provided', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createBookingMock.mockResolvedValue({ orderId: 'o1', totalPrice: 480, clientAlreadyBookedDate: false })
    const { clientEmail, ...noEmail } = validBooking
    void clientEmail

    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noEmail),
    })

    expect(res.status).toBe(201)
    expect(sendBookingConfirmationMock).not.toHaveBeenCalled()
  })

  it('returns 400 on validation failure (short name)', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBooking, clientName: 'J' }),
    })
    expect(res.status).toBe(400)
    expect(createBookingMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the date is no longer available (race condition)', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createBookingMock.mockResolvedValue(null)
    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('no longer available')
  })

  it('returns 409 when client already booked that date', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createBookingMock.mockResolvedValue({ orderId: 'dup', totalPrice: 0, clientAlreadyBookedDate: true })
    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })
    expect(res.status).toBe(409)
    expect(sendBookingConfirmationMock).not.toHaveBeenCalled()
  })

  it('returns 404 when tenant not found', async () => {
    getPublicTenantMock.mockResolvedValue(null)
    const res = await app.request('/book/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })
    expect(res.status).toBe(404)
    expect(createBookingMock).not.toHaveBeenCalled()
  })
})
