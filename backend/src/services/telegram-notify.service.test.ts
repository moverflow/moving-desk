import { beforeEach, describe, expect, it, vi } from 'vitest'

const enabled = { value: true }
const sendTelegramMessageMock = vi.fn()
vi.mock('../lib/telegram.js', () => ({
  isTelegramEnabled: () => enabled.value,
  sendTelegramMessage: (...a: unknown[]) => sendTelegramMessageMock(...a),
}))

vi.mock('../lib/env.js', () => ({ env: { FRONTEND_URL: 'https://app.movingdesk.test' } }))

const loggerErrorMock = vi.fn()
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: (...a: unknown[]) => loggerErrorMock(...a), warn: vi.fn() },
}))

const listTenantChatIdsMock = vi.fn()
vi.mock('./telegram.service.js', () => ({
  listTenantChatIds: (...a: unknown[]) => listTenantChatIdsMock(...a),
}))

const { dispatchTelegramNotification } = await import('./telegram-notify.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const ORDER_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  enabled.value = true
  sendTelegramMessageMock.mockReset()
  loggerErrorMock.mockReset()
  listTenantChatIdsMock.mockReset()
  listTenantChatIdsMock.mockResolvedValue(['5550001'])
})

describe('dispatchTelegramNotification', () => {
  it('sends to every linked chat in the tenant', async () => {
    listTenantChatIdsMock.mockResolvedValue(['5550001', '5550002'])

    await dispatchTelegramNotification({
      tenantId: TENANT_A,
      type: 'lead_new',
      title: 'New lead: Sarah Miller',
      body: '(949) 555-0100 · Added via booking page',
      relatedType: 'lead',
      relatedId: '55555555-5555-4555-8555-555555555555',
    })

    expect(listTenantChatIdsMock).toHaveBeenCalledWith(TENANT_A)
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(2)
    expect(sendTelegramMessageMock.mock.calls[0]?.[0]).toBe('5550001')
    expect(sendTelegramMessageMock.mock.calls[1]?.[0]).toBe('5550002')
  })

  it('formats the message as icon, title, body, then a link back to the app', async () => {
    await dispatchTelegramNotification({
      tenantId: TENANT_A,
      type: 'contract_signed',
      title: 'Contract signed by Sarah Miller',
      body: 'Move on Jun 15, 2026',
      relatedType: 'order',
      relatedId: ORDER_ID,
    })

    expect(sendTelegramMessageMock).toHaveBeenCalledWith(
      '5550001',
      `✍️ Contract signed by Sarah Miller\nMove on Jun 15, 2026\nhttps://app.movingdesk.test/orders?order=${ORDER_ID}`,
    )
  })

  it('links an invoice notification to the invoice, not the order board', async () => {
    await dispatchTelegramNotification({
      tenantId: TENANT_A,
      type: 'invoice_paid',
      title: 'Invoice INV-1089 paid',
      body: '$480 received from Sarah Miller',
      relatedType: 'invoice',
      relatedId: ORDER_ID,
    })

    expect(sendTelegramMessageMock.mock.calls[0]?.[1]).toContain(
      `https://app.movingdesk.test/invoices?invoice=${ORDER_ID}`,
    )
  })

  it('omits the body line when there is none', async () => {
    await dispatchTelegramNotification({
      tenantId: TENANT_A,
      type: 'feedback_new',
      title: 'New feedback',
    })

    expect(sendTelegramMessageMock.mock.calls[0]?.[1]).toBe(
      '💬 New feedback\nhttps://app.movingdesk.test/orders',
    )
  })

  it('does nothing at all when no bot token is configured', async () => {
    enabled.value = false

    await dispatchTelegramNotification({ tenantId: TENANT_A, type: 'lead_new', title: 'New lead' })

    expect(listTenantChatIdsMock).not.toHaveBeenCalled()
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('skips the send when nobody in the tenant has linked', async () => {
    listTenantChatIdsMock.mockResolvedValue([])

    await dispatchTelegramNotification({ tenantId: TENANT_A, type: 'lead_new', title: 'New lead' })

    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('swallows and logs a lookup failure instead of rejecting', async () => {
    listTenantChatIdsMock.mockRejectedValue(new Error('db down'))

    await expect(
      dispatchTelegramNotification({ tenantId: TENANT_A, type: 'lead_new', title: 'New lead' }),
    ).resolves.toBeUndefined()

    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
