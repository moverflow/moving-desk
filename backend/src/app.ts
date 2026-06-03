import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { env } from './lib/env'
import { logger } from './lib/logger'
import auth from './routes/auth'
import crews from './routes/crews'
import orders from './routes/orders'
import users from './routes/users'

const app = new Hono()
app.route('/auth', auth)
app.route('/users', users)
app.route('/orders', orders)
app.route('/crews', crews)

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
