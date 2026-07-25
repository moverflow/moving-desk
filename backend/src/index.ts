import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { assertStorageConfigured } from './lib/r2.js'

try {
  assertStorageConfigured()
} catch (err) {
  logger.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const port = env.PORT

serve({ fetch: app.fetch, port }, () => {
  logger.info(`Server running on port ${port}`)
})
