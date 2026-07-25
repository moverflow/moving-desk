import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initMock = vi.fn()
const captureExceptionMock = vi.fn()
const setTagMock = vi.fn()
const setUserMock = vi.fn()

vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => initMock(...args),
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  withScope: (fn: (scope: { setTag: unknown; setUser: unknown; setContext: unknown }) => void) =>
    fn({ setTag: setTagMock, setUser: setUserMock, setContext: vi.fn() }),
  close: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

async function loadSentry(dsn: string) {
  vi.doMock('./env.js', () => ({ env: { SENTRY_DSN: dsn, NODE_ENV: 'test' } }))
  return import('./sentry.js')
}

beforeEach(() => {
  vi.resetModules()
  initMock.mockReset()
  captureExceptionMock.mockReset()
  setTagMock.mockReset()
  setUserMock.mockReset()
})

afterEach(() => {
  vi.doUnmock('./env.js')
})

describe('with no DSN configured', () => {
  it('reports Sentry as disabled', async () => {
    const { isSentryEnabled } = await loadSentry('')
    expect(isSentryEnabled()).toBe(false)
  })

  it('does not initialise the SDK', async () => {
    const { initSentry } = await loadSentry('')
    initSentry()
    expect(initMock).not.toHaveBeenCalled()
  })

  it('makes captureError a no-op rather than throwing', async () => {
    const { captureError } = await loadSentry('')
    expect(() => captureError(new Error('boom'))).not.toThrow()
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })
})

describe('with a DSN configured', () => {
  const DSN = 'https://abc@o1.ingest.sentry.io/2'

  it('initialises the SDK with the DSN and no tracing', async () => {
    const { initSentry } = await loadSentry(DSN)
    initSentry()

    expect(initMock).toHaveBeenCalledTimes(1)
    const [options] = initMock.mock.calls[0] as [Record<string, unknown>]
    expect(options.dsn).toBe(DSN)
    expect(options.tracesSampleRate).toBe(0)
  })

  it('reports the exception', async () => {
    const { captureError } = await loadSentry(DSN)
    const err = new Error('boom')

    captureError(err)

    expect(captureExceptionMock).toHaveBeenCalledWith(err)
  })

  it('attaches request, route and tenant context as tags', async () => {
    const { captureError } = await loadSentry(DSN)

    captureError(new Error('boom'), {
      requestId: 'req-1',
      route: '/orders',
      method: 'POST',
      statusCode: 500,
      tenantId: 'tenant-1',
    })

    expect(setTagMock).toHaveBeenCalledWith('request_id', 'req-1')
    expect(setTagMock).toHaveBeenCalledWith('route', '/orders')
    expect(setTagMock).toHaveBeenCalledWith('method', 'POST')
    expect(setTagMock).toHaveBeenCalledWith('status_code', '500')
    expect(setTagMock).toHaveBeenCalledWith('tenant_id', 'tenant-1')
  })

  it('identifies the user when a userId is supplied', async () => {
    const { captureError } = await loadSentry(DSN)
    captureError(new Error('boom'), { userId: 'user-1' })
    expect(setUserMock).toHaveBeenCalledWith({ id: 'user-1' })
  })

  it('omits tags for context that was not supplied', async () => {
    const { captureError } = await loadSentry(DSN)
    captureError(new Error('boom'), { route: '/orders' })

    const tagged = setTagMock.mock.calls.map((call) => call[0] as string)
    expect(tagged).toContain('route')
    expect(tagged).not.toContain('tenant_id')
    expect(setUserMock).not.toHaveBeenCalled()
  })

  it('captures non-Error rejection values too', async () => {
    const { captureError } = await loadSentry(DSN)
    captureError('a string rejection')
    expect(captureExceptionMock).toHaveBeenCalledWith('a string rejection')
  })
})
