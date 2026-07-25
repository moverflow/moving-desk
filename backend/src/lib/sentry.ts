import * as Sentry from '@sentry/node'
import { env } from './env.js'
import { logger } from './logger.js'

export interface ErrorContext {
  requestId?: string
  method?: string
  route?: string
  tenantId?: string
  userId?: string
  statusCode?: number
}

export function isSentryEnabled(): boolean {
  return env.SENTRY_DSN.length > 0
}

// Error capture only — tracing and profiling are deliberately off, so this adds
// no per-request overhead beyond an exception handler. With no DSN configured
// Sentry.init() is skipped entirely and every capture below becomes a no-op,
// which keeps local dev and CI free of network calls.
export function initSentry(): void {
  if (!isSentryEnabled()) {
    logger.info('Sentry disabled (SENTRY_DSN not set)')
    return
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
  })

  logger.info('Sentry initialised')
}

// Reports through an isolated scope so tags from one request can never leak
// onto a concurrently handled one.
export function captureError(error: unknown, context: ErrorContext = {}): void {
  if (!isSentryEnabled()) return

  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('request_id', context.requestId)
    if (context.route) scope.setTag('route', context.route)
    if (context.method) scope.setTag('method', context.method)
    if (context.statusCode) scope.setTag('status_code', String(context.statusCode))
    if (context.tenantId) scope.setTag('tenant_id', context.tenantId)
    if (context.userId) scope.setUser({ id: context.userId })
    Sentry.captureException(error)
  })
}

// Last-resort process handlers. Node terminates on an unhandled rejection by
// default, so the report is flushed before the process is allowed to exit.
export function installProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
    captureError(reason, { route: 'process/unhandledRejection' })
  })

  process.on('uncaughtException', (error: Error) => {
    logger.error({ err: error }, 'Uncaught exception')
    captureError(error, { route: 'process/uncaughtException' })
    void Sentry.close(2000).then(() => process.exit(1))
  })
}
