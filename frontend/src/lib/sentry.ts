import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN

export function isSentryEnabled(): boolean {
  return typeof DSN === 'string' && DSN.length > 0
}

// Error capture only — no session replay or performance tracing. With no DSN
// configured init is skipped and every Sentry call becomes a no-op, so local
// dev and tests never reach the network.
export function initSentry(): void {
  if (!isSentryEnabled()) return

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}

export function captureError(error: unknown, componentStack?: string): void {
  if (!isSentryEnabled()) return

  Sentry.withScope((scope) => {
    if (componentStack) scope.setContext('react', { componentStack })
    Sentry.captureException(error)
  })
}
