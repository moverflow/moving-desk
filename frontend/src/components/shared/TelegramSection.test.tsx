import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TelegramSection from './TelegramSection'
import type { TelegramLinkCode, TelegramStatus } from '@/types'

vi.mock('@/hooks/useTelegram', () => ({
  useTelegramStatus: vi.fn(),
  useCreateTelegramLinkCode: vi.fn(),
  useDisconnectTelegram: vi.fn(),
}))

import {
  useCreateTelegramLinkCode,
  useDisconnectTelegram,
  useTelegramStatus,
} from '@/hooks/useTelegram'

const LINK: TelegramLinkCode = {
  code: 'ABCD2345',
  deepLink: 'https://t.me/movingdesk_bot?start=ABCD2345',
  expiresAt: '2026-08-12T12:15:00.000Z',
}

const createCodeMock = vi.fn()
const disconnectMock = vi.fn()

function setup(status: TelegramStatus | undefined, isError = false): void {
  vi.mocked(useTelegramStatus).mockReturnValue(
    { data: status } as unknown as ReturnType<typeof useTelegramStatus>,
  )
  vi.mocked(useCreateTelegramLinkCode).mockReturnValue(
    { mutate: createCodeMock, isPending: false, isError } as unknown as ReturnType<typeof useCreateTelegramLinkCode>,
  )
  vi.mocked(useDisconnectTelegram).mockReturnValue(
    { mutate: disconnectMock, isPending: false } as unknown as ReturnType<typeof useDisconnectTelegram>,
  )
}

beforeEach(() => {
  createCodeMock.mockReset()
  disconnectMock.mockReset()
})

describe('TelegramSection', () => {
  // AC3: with no TELEGRAM_BOT_TOKEN the server reports enabled:false and the
  // owner is never offered a connect flow that cannot complete.
  it('renders nothing when the server has no bot configured', () => {
    setup({ enabled: false, connected: false, botUsername: '' })
    const { container } = render(<TelegramSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing before the status has loaded', () => {
    setup(undefined)
    const { container } = render(<TelegramSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('offers a connect button when the bot is available but unlinked', () => {
    setup({ enabled: true, connected: false, botUsername: 'movingdesk_bot' })
    render(<TelegramSection />)

    expect(screen.getByRole('button', { name: /connect telegram/i })).toBeInTheDocument()
    expect(screen.queryByText('ABCD2345')).not.toBeInTheDocument()
  })

  it('shows the code and the deep link after generating one', async () => {
    setup({ enabled: true, connected: false, botUsername: 'movingdesk_bot' })
    createCodeMock.mockImplementation((_input, opts) => opts.onSuccess(LINK))
    const user = userEvent.setup()
    render(<TelegramSection />)

    await user.click(screen.getByRole('button', { name: /connect telegram/i }))

    expect(screen.getByText('ABCD2345')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open telegram/i })).toHaveAttribute(
      'href',
      LINK.deepLink,
    )
  })

  it('shows connected state with a disconnect action once linked', async () => {
    setup({ enabled: true, connected: true, botUsername: 'movingdesk_bot' })
    const user = userEvent.setup()
    render(<TelegramSection />)

    expect(screen.getByText(/connected/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /disconnect/i }))

    expect(disconnectMock).toHaveBeenCalled()
  })

  it('surfaces a failure to generate a code', () => {
    setup({ enabled: true, connected: false, botUsername: 'movingdesk_bot' }, true)
    render(<TelegramSection />)

    expect(screen.getByText(/could not generate a code/i)).toBeInTheDocument()
  })
})
