import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import auth from './routes/auth.js'
import billing from './routes/billing.js'
import clients from './routes/clients.js'
import settings from './routes/settings.js'
import crews from './routes/crews.js'
import invoices from './routes/invoices.js'
import orders from './routes/orders.js'
import users from './routes/users.js'

const app = new Hono()
app.route('/auth', auth)
app.route('/users', users)
app.route('/orders', orders)
app.route('/crews', crews)
app.route('/invoices', invoices)
app.route('/clients', clients)
app.route('/billing', billing)
app.route('/settings', settings)

app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)

app.use('*', honoLogger((str) => logger.info(str)))

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.onError((err, c) => {
  logger.error(err)
  const status = (err as { status?: number }).status ?? 500
  return c.json({ error: err.message, status }, status as Parameters<typeof c.json>[1])
})

export default app
