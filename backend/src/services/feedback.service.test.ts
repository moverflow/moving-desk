import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insertReturnQueue, insertValues } = vi.hoisted(() => ({
  insertReturnQueue: [] as unknown[][],
  insertValues: [] as unknown[],
}))

vi.mock('../db/index.js', () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => {
        insertValues.push(v)
        return { returning: () => Promise.resolve(insertReturnQueue.shift() ?? []) }
      },
    }),
  },
}))

const createNotificationMock = vi.fn()
vi.mock('./notifications.service.js', () => ({
  createNotification: (...a: unknown[]) => createNotificationMock(...a),
}))

const { createFeedback } = await import('./feedback.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const USER_A = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  insertReturnQueue.length = 0
  insertValues.length = 0
  createNotificationMock.mockReset()
  createNotificationMock.mockResolvedValue(undefined)
})

describe('createFeedback', () => {
  it('AC1 — writes a tenant + user scoped row for an authenticated submission', async () => {
    insertReturnQueue.push([{ id: 'feedback-1' }])

    await createFeedback({
      tenantId: TENANT_A,
      userId: USER_A,
      message: 'The invoice PDF is missing the logo',
      pageUrl: '/invoices',
      severity: 'bug',
    })

    expect(insertValues[0]).toMatchObject({
      tenant_id: TENANT_A,
      user_id: USER_A,
      message: 'The invoice PDF is missing the logo',
      page_url: '/invoices',
      severity: 'bug',
    })
  })

  it('AC2 — writes a row with null tenant/user for an anonymous submission', async () => {
    insertReturnQueue.push([{ id: 'feedback-2' }])

    await createFeedback({
      tenantId: null,
      userId: null,
      message: 'Love the guide page!',
      pageUrl: '/guide',
    })

    expect(insertValues[0]).toMatchObject({
      tenant_id: null,
      user_id: null,
      message: 'Love the guide page!',
      page_url: '/guide',
      severity: null,
    })
  })

  it('AC3 — raises a tenant-scoped notification pointing at the new feedback row', async () => {
    insertReturnQueue.push([{ id: 'feedback-9' }])

    await createFeedback({
      tenantId: TENANT_A,
      userId: USER_A,
      message: 'Booking calendar looks empty even with a crew added',
      pageUrl: '/settings',
      severity: 'bug',
    })

    expect(createNotificationMock).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      type: 'feedback_new',
      title: 'Bug reported',
      body: 'Booking calendar looks empty even with a crew added',
      relatedType: 'feedback',
      relatedId: 'feedback-9',
    })
  })

  it('AC3 — does not raise a notification when there is no tenant to notify', async () => {
    insertReturnQueue.push([{ id: 'feedback-3' }])

    await createFeedback({ tenantId: null, userId: null, message: 'Anonymous note', pageUrl: '/guide' })

    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('truncates a long message in the notification body but stores it in full', async () => {
    const longMessage = 'x'.repeat(250)
    insertReturnQueue.push([{ id: 'feedback-4' }])

    await createFeedback({ tenantId: TENANT_A, userId: null, message: longMessage, pageUrl: '/orders' })

    expect(insertValues[0]).toMatchObject({ message: longMessage })
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: `${'x'.repeat(200)}…` }),
    )
  })
})
