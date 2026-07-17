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
vi.mock('../services/booking.service.js', () => ({
  getPublicTenant: (...a: unknown[]) => getPublicTenantMock(...a),
  getAvailability: (...a: unknown[]) => getAvailabilityMock(...a),
}))

const createLeadMock = vi.fn()
vi.mock('../services/leads.service.js', () => ({
  createLead: (...a: unknown[]) => createLeadMock(...a),
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
  createLeadMock.mockReset()
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
  it('AC9/AC10 — captures a lead and returns a "request received" message', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createLeadMock.mockResolvedValue({ id: 'lead-123' })

    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean; leadId: string; confirmationMessage: string }
    expect(body.success).toBe(true)
    expect(body.leadId).toBe('lead-123')
    expect(body.confirmationMessage).toContain('Best Movers LLC')
    expect(body.confirmationMessage).toContain('Jane Client')

    // Lead is created for this tenant with the booking_page source.
    expect(createLeadMock).toHaveBeenCalledTimes(1)
    const [tenantId, createdBy, input] = createLeadMock.mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(tenantId).toBe(TENANT.id)
    expect(createdBy).toBeNull()
    expect(input.source).toBe('booking_page')
    expect(input.name).toBe('Jane Client')
  })

  it('captures a lead even when no clientEmail is provided', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    createLeadMock.mockResolvedValue({ id: 'lead-1' })
    const { clientEmail, ...noEmail } = validBooking
    void clientEmail

    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noEmail),
    })

    expect(res.status).toBe(201)
    expect(createLeadMock).toHaveBeenCalledTimes(1)
  })

  it('returns 400 on validation failure (short name)', async () => {
    getPublicTenantMock.mockResolvedValue(TENANT)
    const res = await app.request('/book/best-movers-llc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBooking, clientName: 'J' }),
    })
    expect(res.status).toBe(400)
    expect(createLeadMock).not.toHaveBeenCalled()
  })

  it('returns 404 when tenant not found', async () => {
    getPublicTenantMock.mockResolvedValue(null)
    const res = await app.request('/book/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBooking),
    })
    expect(res.status).toBe(404)
    expect(createLeadMock).not.toHaveBeenCalled()
  })
})
