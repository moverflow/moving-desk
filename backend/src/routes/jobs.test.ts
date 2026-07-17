import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/env.js', () => ({
  env: {
    CRON_SECRET: 'super-secret-cron-token',
    FRONTEND_URL: 'http://localhost:5173',
    NODE_ENV: 'test',
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const sendDailyRemindersMock = vi.fn()
vi.mock('../jobs/reminder.js', () => ({
  sendDailyReminders: () => sendDailyRemindersMock(),
}))

const { default: jobsRouter } = await import('./jobs.js')

const app = new Hono().route('/jobs', jobsRouter)

const SECRET = 'super-secret-cron-token'

beforeEach(() => {
  sendDailyRemindersMock.mockReset()
  sendDailyRemindersMock.mockResolvedValue(undefined)
})

describe('POST /jobs/reminders', () => {
  it('AC6 — returns 401 when no secret header is present', async () => {
    const res = await app.request('/jobs/reminders', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(sendDailyRemindersMock).not.toHaveBeenCalled()
  })

  it('AC7 — returns 401 when the secret is wrong', async () => {
    const res = await app.request('/jobs/reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong' },
    })
    expect(res.status).toBe(401)
    expect(sendDailyRemindersMock).not.toHaveBeenCalled()
  })

  it('AC8 — returns 200 and starts the job with the correct secret', async () => {
    const res = await app.request('/jobs/reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Reminder job started' })
    expect(sendDailyRemindersMock).toHaveBeenCalledTimes(1)
  })

  it('still returns 200 even if the job rejects (runs detached)', async () => {
    sendDailyRemindersMock.mockRejectedValue(new Error('boom'))
    const res = await app.request('/jobs/reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET },
    })
    expect(res.status).toBe(200)
  })
})
