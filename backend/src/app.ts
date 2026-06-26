import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { UPLOADS_ROOT } from './lib/r2.js'
import auth from './routes/auth.js'
import billing from './routes/billing.js'
import clients from './routes/clients.js'
import settings from './routes/settings.js'
import crews from './routes/crews.js'
import invoices from './routes/invoices.js'
import orders from './routes/orders.js'
import users from './routes/users.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)

app.use('*', honoLogger((str) => logger.info(str)))

app.route('/auth', auth)
app.route('/users', users)
app.route('/orders', orders)
app.route('/crews', crews)
app.route('/invoices', invoices)
app.route('/clients', clients)
app.route('/billing', billing)
app.route('/settings', settings)

const UPLOAD_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

app.get('/uploads/*', async (c) => {
  const relativePath = c.req.path.replace(/^\/uploads\//, '')
  const filePath = path.resolve(UPLOADS_ROOT, relativePath)
  if (!filePath.startsWith(UPLOADS_ROOT)) return c.notFound()

  try {
    const content = await readFile(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    return c.body(content, 200, { 'Content-Type': UPLOAD_MIME[ext] ?? 'application/octet-stream' })
  } catch {
    return c.notFound()
  }
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.onError((err, c) => {
  logger.error(err)
  const status = (err as { status?: number }).status ?? 500
  return c.json({ error: err.message, status }, status as Parameters<typeof c.json>[1])
})

export default app
