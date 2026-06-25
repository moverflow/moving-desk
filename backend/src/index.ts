import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './lib/env'
import { logger } from './lib/logger'

const port = env.PORT

serve({ fetch: app.fetch, port }, () => {
  logger.info(`Server running on port ${port}`)
})
