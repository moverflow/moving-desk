// Must be the first import: ESM evaluates a module's imports in source order,
// so this initialises Sentry before ./app.js and its route tree are loaded.
import { initSentry, installProcessErrorHandlers } from './lib/sentry.js'
import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { assertStorageConfigured } from './lib/r2.js'
import { assertStripeConfigured } from './lib/stripe.js'

initSentry()
installProcessErrorHandlers()

try {
  assertStorageConfigured()
  assertStripeConfigured()
} catch (err) {
  logger.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const port = env.PORT

serve({ fetch: app.fetch, port }, () => {
  logger.info(`Server running on port ${port}`)
})
