import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { UPLOADS_ROOT } from './lib/r2.js'
import { captureError } from './lib/sentry.js'
import type { AppVariables } from './types/index.js'
import auth from './routes/auth.js'
import billing from './routes/billing.js'
import book from './routes/book.js'
import contract from './routes/contract.js'
import crew from './routes/crew.js'
import clients from './routes/clients.js'
import dashboard from './routes/dashboard.js'
import settings from './routes/settings.js'
import crews from './routes/crews.js'
import invoices from './routes/invoices.js'
import jobs from './routes/jobs.js'
import leads from './routes/leads.js'
import orders from './routes/orders.js'
import users from './routes/users.js'

const app = new Hono<{ Variables: AppVariables }>()

// Correlation id for every request: echoed to the client on a 5xx and attached
// to the log line and the Sentry event, so a reported error can be traced back
// to its stack without exposing anything about it.
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID()
  c.set('requestId', requestId)
  c.header('x-request-id', requestId)
  await next()
})

app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    // Without this the browser hides the correlation id from frontend code,
    // since the API and the app are on different origins.
    exposeHeaders: ['x-request-id'],
  })
)

app.use('*', honoLogger((str) => logger.info(str)))

app.route('/book', book)
app.route('/contract', contract)
app.route('/auth', auth)
app.route('/users', users)
app.route('/orders', orders)
app.route('/crews', crews)
app.route('/crew', crew)
app.route('/invoices', invoices)
app.route('/clients', clients)
app.route('/billing', billing)
app.route('/settings', settings)
app.route('/dashboard', dashboard)
app.route('/jobs', jobs)
app.route('/leads', leads)

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
  const status = (err as { status?: number }).status ?? 500
  const requestId = c.get('requestId') ?? randomUUID()

  logger.error({ err, requestId, path: c.req.path, status }, 'Request failed')

  // 4xx is a deliberate, already-safe message ("Unauthorized", "Validation
  // failed") — pass it through. 5xx is an unplanned failure whose message can
  // carry Postgres constraint and column names, so the client gets a generic
  // message plus the id needed to find the real one in the logs.
  if (status >= 500) {
    captureError(err, {
      requestId,
      method: c.req.method,
      route: c.req.path,
      statusCode: status,
      tenantId: c.get('tenantId'),
      userId: c.get('userId'),
    })
    return c.json({ error: 'Something went wrong on our end.', requestId, status: 500 }, 500)
  }

  return c.json({ error: err.message, status }, status as Parameters<typeof c.json>[1])
})

export default app
