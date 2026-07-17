import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendMock(...args) }
  },
}))

vi.mock('./env.js', () => ({
  env: {
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'MovingDesk <notify@movingdesk.test>',
    FRONTEND_URL: 'http://localhost:5173',
  },
}))

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const { sendMoveCompletedEmail, sendMoveReminderEmail } = await import('./email.js')

type SendPayload = { from: string; to: string; subject: string; text: string }

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ id: 'email-1' })
})

describe('sendMoveCompletedEmail', () => {
  it('AC3/AC14 — uses EMAIL_FROM sender and includes review request text', async () => {
    await sendMoveCompletedEmail({
      to: 'jane@example.com',
      clientName: 'Jane',
      companyName: 'Acme Movers',
      companyPhone: '(949) 555-0100',
      moveDate: 'Jul 18, 2026',
      invoiceUrl: 'http://localhost:5173/i/tok-abc',
    })

    const payload = sendMock.mock.calls[0][0] as SendPayload
    expect(payload.from).toBe('MovingDesk <notify@movingdesk.test>')
    expect(payload.to).toBe('jane@example.com')
    expect(payload.text.toLowerCase()).toContain('review')
    expect(payload.text).toContain('Jul 18, 2026')
  })

  it('AC2 — includes the invoice link when one is provided', async () => {
    await sendMoveCompletedEmail({
      to: 'jane@example.com',
      clientName: 'Jane',
      companyName: 'Acme Movers',
      companyPhone: null,
      moveDate: 'Jul 18, 2026',
      invoiceUrl: 'http://localhost:5173/i/tok-abc',
    })

    const payload = sendMock.mock.calls[0][0] as SendPayload
    expect(payload.text).toContain('http://localhost:5173/i/tok-abc')
  })

  it('omits the invoice link and phone line when both are absent', async () => {
    await sendMoveCompletedEmail({
      to: 'jane@example.com',
      clientName: 'Jane',
      companyName: 'Acme Movers',
      companyPhone: null,
      moveDate: 'Jul 18, 2026',
      invoiceUrl: null,
    })

    const payload = sendMock.mock.calls[0][0] as SendPayload
    expect(payload.text).not.toContain('/i/')
    expect(payload.text).not.toContain('Call us')
  })
})

describe('sendMoveReminderEmail', () => {
  it('includes the move date and both addresses', async () => {
    await sendMoveReminderEmail({
      to: 'jane@example.com',
      clientName: 'Jane',
      companyName: 'Acme Movers',
      companyPhone: '(949) 555-0100',
      moveDate: 'Jul 18, 2026',
      fromAddress: '1 Main St',
      toAddress: '2 Oak Ave',
    })

    const payload = sendMock.mock.calls[0][0] as SendPayload
    expect(payload.subject).toBe('Reminder: Your move is tomorrow!')
    expect(payload.text).toContain('1 Main St')
    expect(payload.text).toContain('2 Oak Ave')
    expect(payload.text).toContain('Jul 18, 2026')
    expect(payload.text).toContain('(949) 555-0100')
  })
})
