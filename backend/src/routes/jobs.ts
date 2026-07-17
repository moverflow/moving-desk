import { Hono } from 'hono'
import { env } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { sendDailyReminders, sendUncontactedLeadReminders } from '../jobs/reminder.js'

const jobsRouter = new Hono()

// Triggered by the Railway cron service, not user auth — guarded by a shared
// secret sent as x-cron-secret. The job runs detached so cron gets a fast 200.
jobsRouter.post('/reminders', (c) => {
  const secret = c.req.header('x-cron-secret')
  if (secret !== env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  sendDailyReminders().catch((err: unknown) => logger.error({ err }, 'Reminder job failed'))
  sendUncontactedLeadReminders().catch((err: unknown) =>
    logger.error({ err }, 'Lead reminder job failed'),
  )

  return c.json({ message: 'Reminder job started' })
})

export default jobsRouter
