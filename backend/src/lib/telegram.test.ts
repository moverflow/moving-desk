import { beforeEach, describe, expect, it, vi } from 'vitest'

const envValues = {
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_BOT_USERNAME: '',
  TELEGRAM_WEBHOOK_SECRET: '',
  BACKEND_URL: 'https://api.movingdesk.test',
}

vi.mock('./env.js', () => ({ env: envValues }))

const loggerInfoMock = vi.fn()
const loggerErrorMock = vi.fn()
vi.mock('./logger.js', () => ({
  logger: {
    info: (...a: unknown[]) => loggerInfoMock(...a),
    error: (...a: unknown[]) => loggerErrorMock(...a),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

// The bot must never be constructed while the integration is off, so this
// records whether grammy was touched at all.
const botConstructions: string[] = []
vi.mock('grammy', () => ({
  Bot: class {
    api = { sendMessage: vi.fn(), setWebhook: vi.fn() }
    constructor(token: string) {
      botConstructions.push(token)
    }
  },
}))

const {
  assertTelegramConfigured,
  isTelegramEnabled,
  sendTelegramMessage,
  telegramDeepLink,
  registerTelegramWebhook,
} = await import('./telegram.js')

beforeEach(() => {
  envValues.TELEGRAM_BOT_TOKEN = ''
  envValues.TELEGRAM_BOT_USERNAME = ''
  envValues.TELEGRAM_WEBHOOK_SECRET = ''
  botConstructions.length = 0
  loggerInfoMock.mockReset()
  loggerErrorMock.mockReset()
})

describe('isTelegramEnabled', () => {
  it('is off with no token', () => {
    expect(isTelegramEnabled()).toBe(false)
  })

  it('is on once a token is set', () => {
    envValues.TELEGRAM_BOT_TOKEN = '123:abc'
    expect(isTelegramEnabled()).toBe(true)
  })
})

describe('assertTelegramConfigured', () => {
  it('allows startup with the integration switched off', () => {
    expect(() => assertTelegramConfigured()).not.toThrow()
  })

  it('refuses to start with a token but no webhook secret', () => {
    envValues.TELEGRAM_BOT_TOKEN = '123:abc'
    envValues.TELEGRAM_BOT_USERNAME = 'movingdesk_bot'

    expect(() => assertTelegramConfigured()).toThrow(/TELEGRAM_WEBHOOK_SECRET/)
  })

  it('refuses to start with a token but no bot username', () => {
    envValues.TELEGRAM_BOT_TOKEN = '123:abc'
    envValues.TELEGRAM_WEBHOOK_SECRET = 'secret-value-16-chars'

    expect(() => assertTelegramConfigured()).toThrow(/TELEGRAM_BOT_USERNAME/)
  })

  it('allows startup when everything is set', () => {
    envValues.TELEGRAM_BOT_TOKEN = '123:abc'
    envValues.TELEGRAM_BOT_USERNAME = 'movingdesk_bot'
    envValues.TELEGRAM_WEBHOOK_SECRET = 'secret-value-16-chars'

    expect(() => assertTelegramConfigured()).not.toThrow()
  })
})

describe('sendTelegramMessage', () => {
  it('is a no-op when no bot is configured', () => {
    expect(() => sendTelegramMessage('5550001', 'hello')).not.toThrow()
    expect(botConstructions).toHaveLength(0)
  })
})

describe('registerTelegramWebhook', () => {
  it('logs that the integration is off and registers nothing', async () => {
    await registerTelegramWebhook()

    expect(botConstructions).toHaveLength(0)
    expect(loggerInfoMock).toHaveBeenCalledWith('Telegram disabled (TELEGRAM_BOT_TOKEN not set)')
  })
})

describe('telegramDeepLink', () => {
  it('builds a t.me start link for the configured bot', () => {
    envValues.TELEGRAM_BOT_USERNAME = 'movingdesk_bot'

    expect(telegramDeepLink('ABCD2345')).toBe('https://t.me/movingdesk_bot?start=ABCD2345')
  })
})
