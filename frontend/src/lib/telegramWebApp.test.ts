import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTelegramViewport } from './telegramWebApp'
import type { TelegramEvent, TelegramWebApp } from './telegramWebApp'

type Handlers = Partial<Record<TelegramEvent, () => void>>

interface BridgeOptions {
  viewportHeight?: number
  viewportStableHeight?: number
  safeBottom?: number
  contentSafeBottom?: number
  // A Telegram client from before Bot API 6.x, which has no event API at all.
  legacy?: boolean
}

function bridge(options: BridgeOptions = {}): { webApp: TelegramWebApp; handlers: Handlers } {
  const handlers: Handlers = {}

  const webApp: TelegramWebApp = {
    initData: 'user=%7B%7D&hash=abc',
    colorScheme: 'light',
    themeParams: {},
    ready: vi.fn(),
    expand: vi.fn(),
    ...(options.viewportHeight === undefined ? {} : { viewportHeight: options.viewportHeight }),
    ...(options.viewportStableHeight === undefined
      ? {}
      : { viewportStableHeight: options.viewportStableHeight }),
    ...(options.safeBottom === undefined ? {} : { safeAreaInset: { bottom: options.safeBottom } }),
    ...(options.contentSafeBottom === undefined
      ? {}
      : { contentSafeAreaInset: { bottom: options.contentSafeBottom } }),
    ...(options.legacy
      ? {}
      : {
          onEvent: (event: TelegramEvent, handler: () => void) => {
            handlers[event] = handler
          },
          offEvent: (event: TelegramEvent) => {
            delete handlers[event]
          },
        }),
  }

  return { webApp, handlers }
}

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

afterEach(() => {
  document.documentElement.style.removeProperty('--tg-app-height')
  document.documentElement.style.removeProperty('--tg-safe-bottom')
})

describe('applyTelegramViewport — height', () => {
  it('publishes the height Telegram reports instead of leaving the page on 100vh', () => {
    applyTelegramViewport(bridge({ viewportStableHeight: 620 }).webApp)

    expect(cssVar('--tg-app-height')).toBe('620px')
  })

  // The live height tracks the on-screen keyboard; resizing the shell under the
  // user mid-sentence is worse than letting the browser scroll the input in.
  it('prefers the stable height over the live one', () => {
    applyTelegramViewport(bridge({ viewportHeight: 300, viewportStableHeight: 620 }).webApp)

    expect(cssVar('--tg-app-height')).toBe('620px')
  })

  it('falls back to the live height when no stable one is reported', () => {
    applyTelegramViewport(bridge({ viewportHeight: 480 }).webApp)

    expect(cssVar('--tg-app-height')).toBe('480px')
  })

  it('leaves the stylesheet default in place when Telegram reports no height', () => {
    applyTelegramViewport(bridge().webApp)

    expect(cssVar('--tg-app-height')).toBe('')
  })

  it('ignores a zero height rather than collapsing the app to nothing', () => {
    applyTelegramViewport(bridge({ viewportStableHeight: 0 }).webApp)

    expect(cssVar('--tg-app-height')).toBe('')
  })
})

describe('applyTelegramViewport — bottom inset', () => {
  // contentSafeAreaInset is measured inside safeAreaInset, so the distance from
  // the window edge to usable content is the two added together.
  it('adds the device inset and Telegram chrome inset', () => {
    applyTelegramViewport(bridge({ safeBottom: 34, contentSafeBottom: 16 }).webApp)

    expect(cssVar('--tg-safe-bottom')).toBe('50px')
  })

  it('uses whichever of the two a client reports on its own', () => {
    applyTelegramViewport(bridge({ safeBottom: 34 }).webApp)

    expect(cssVar('--tg-safe-bottom')).toBe('34px')
  })

  // An older client reports nothing; the CSS default (env(safe-area-inset-bottom))
  // must survive rather than being overwritten with a hard 0.
  it('leaves the stylesheet default in place when there is no inset to report', () => {
    applyTelegramViewport(bridge({ viewportStableHeight: 620 }).webApp)

    expect(cssVar('--tg-safe-bottom')).toBe('')
  })
})

describe('applyTelegramViewport — staying current', () => {
  it('re-measures when Telegram says the viewport changed', () => {
    const { webApp, handlers } = bridge({ viewportStableHeight: 620 })
    applyTelegramViewport(webApp)

    Object.assign(webApp, { viewportStableHeight: 400, safeAreaInset: { bottom: 34 } })
    handlers.viewportChanged?.()

    expect(cssVar('--tg-app-height')).toBe('400px')
    expect(cssVar('--tg-safe-bottom')).toBe('34px')
  })

  it('subscribes to the safe-area events as well as the viewport one', () => {
    const { webApp, handlers } = bridge({ viewportStableHeight: 620 })
    applyTelegramViewport(webApp)

    expect(Object.keys(handlers).sort()).toEqual([
      'contentSafeAreaChanged',
      'safeAreaChanged',
      'viewportChanged',
    ])
  })

  it('unsubscribes on cleanup so an unmounted Mini App stops writing to the page', () => {
    const { webApp, handlers } = bridge({ viewportStableHeight: 620 })

    applyTelegramViewport(webApp)()

    expect(Object.keys(handlers)).toHaveLength(0)
  })
})

describe('applyTelegramViewport — no usable bridge', () => {
  it('does nothing outside Telegram, and returns a cleanup that is safe to call', () => {
    const release = applyTelegramViewport(null)

    expect(cssVar('--tg-app-height')).toBe('')
    expect(() => release()).not.toThrow()
  })

  it('still measures once on a client too old to offer the event API', () => {
    const release = applyTelegramViewport(bridge({ viewportStableHeight: 620, legacy: true }).webApp)

    expect(cssVar('--tg-app-height')).toBe('620px')
    expect(() => release()).not.toThrow()
  })
})
