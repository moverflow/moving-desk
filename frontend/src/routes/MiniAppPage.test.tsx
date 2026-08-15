import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/api'
import MiniAppPage from './MiniAppPage'
import type { TelegramWebApp } from '@/lib/telegramWebApp'

vi.mock('@/lib/telegramWebApp', () => ({
  loadTelegramWebApp: vi.fn(),
  applyTelegramTheme: vi.fn(),
}))

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantSession: vi.fn(),
  useAssistantLink: vi.fn(),
}))

// The chat itself has its own suite; here it only needs to be identifiable.
vi.mock('@/features/assistant/ChatView', () => ({
  default: ({ company }: { company: string }) => <div>chat for {company}</div>,
}))

import { applyTelegramTheme, loadTelegramWebApp } from '@/lib/telegramWebApp'
import { useAssistantLink, useAssistantSession } from '@/hooks/useAssistant'

const sessionMock = vi.fn()
const linkMock = vi.fn()

function webApp(initData: string): TelegramWebApp {
  return {
    initData,
    colorScheme: 'light',
    themeParams: { bg_color: '#ffffff' },
    ready: vi.fn(),
    expand: vi.fn(),
  }
}

interface SetupOptions {
  bridge?: TelegramWebApp | null
  linkPending?: boolean
  linkError?: unknown
}

function setup(options: SetupOptions = {}): void {
  vi.mocked(loadTelegramWebApp).mockResolvedValue(
    options.bridge === undefined ? webApp('user=%7B%7D&hash=abc') : options.bridge,
  )

  vi.mocked(useAssistantSession).mockReturnValue({
    mutateAsync: sessionMock,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useAssistantSession>)

  vi.mocked(useAssistantLink).mockReturnValue({
    mutateAsync: linkMock,
    isPending: options.linkPending ?? false,
    error: options.linkError ?? null,
  } as unknown as ReturnType<typeof useAssistantLink>)
}

beforeEach(() => {
  sessionMock.mockReset()
  linkMock.mockReset()
  vi.mocked(applyTelegramTheme).mockClear()
})

describe('MiniAppPage — bootstrap', () => {
  it('exchanges initData for a session and opens the chat', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: true, company: 'Acme Movers', token: 't', user: {} })

    render(<MiniAppPage />)

    expect(await screen.findByText('chat for Acme Movers')).toBeInTheDocument()
    expect(sessionMock).toHaveBeenCalledWith('user=%7B%7D&hash=abc')
  })

  it('adopts the Telegram theme', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: true, company: 'Acme Movers', token: 't', user: {} })

    render(<MiniAppPage />)
    await screen.findByText('chat for Acme Movers')

    expect(applyTelegramTheme).toHaveBeenCalled()
  })

  // Opened in a plain browser there is no signed initData, so there is nothing
  // to authenticate with — say so instead of showing a chat that cannot work.
  it('explains itself when there is no Telegram bridge', async () => {
    setup({ bridge: null })

    render(<MiniAppPage />)

    expect(await screen.findByText(/open this from telegram/i)).toBeInTheDocument()
    expect(sessionMock).not.toHaveBeenCalled()
  })

  it('explains itself when the bridge carries no initData', async () => {
    setup({ bridge: webApp('') })

    render(<MiniAppPage />)

    expect(await screen.findByText(/open this from telegram/i)).toBeInTheDocument()
    expect(sessionMock).not.toHaveBeenCalled()
  })

  it('reports a session that could not be verified', async () => {
    setup()
    sessionMock.mockRejectedValue(new ApiError(401, 'Could not verify this Telegram session'))

    render(<MiniAppPage />)

    expect(await screen.findByText(/could not verify this session/i)).toBeInTheDocument()
  })

  it('starts the session exchange only once per mount', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: true, company: 'Acme Movers', token: 't', user: {} })

    render(<MiniAppPage />)
    await screen.findByText('chat for Acme Movers')

    expect(sessionMock).toHaveBeenCalledOnce()
  })
})

describe('MiniAppPage — linking', () => {
  it('asks for a connect code when the Telegram account is not linked', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: false })

    render(<MiniAppPage />)

    expect(await screen.findByText(/connect your account/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/connect code/i)).toBeInTheDocument()
    // Points at the same place feature 1 puts the code.
    expect(screen.getByText(/settings → integrations/i)).toBeInTheDocument()
  })

  it('submits the code with the verified initData and opens the chat', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: false })
    linkMock.mockResolvedValue({ linked: true, company: 'Acme Movers', token: 't', user: {} })
    const user = userEvent.setup()

    render(<MiniAppPage />)
    await screen.findByLabelText(/connect code/i)

    await user.type(screen.getByLabelText(/connect code/i), 'abcd2345')
    await user.click(screen.getByRole('button', { name: /connect/i }))

    expect(linkMock).toHaveBeenCalledWith({
      initData: 'user=%7B%7D&hash=abc',
      code: 'ABCD2345',
    })
    expect(await screen.findByText('chat for Acme Movers')).toBeInTheDocument()
  })

  it('uppercases the code as it is typed', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: false })
    const user = userEvent.setup()

    render(<MiniAppPage />)
    const input = await screen.findByLabelText(/connect code/i)
    await user.type(input, 'abcd2345')

    expect(input).toHaveValue('ABCD2345')
  })

  it('will not submit a code that is too short to be one', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: false })
    const user = userEvent.setup()

    render(<MiniAppPage />)
    await user.type(await screen.findByLabelText(/connect code/i), 'AB')

    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled()
    expect(linkMock).not.toHaveBeenCalled()
  })

  it('surfaces the reason a code was rejected', async () => {
    setup({ linkError: new ApiError(410, 'That code has expired. Generate a fresh one in Settings.') })
    sessionMock.mockResolvedValue({ linked: false })

    render(<MiniAppPage />)

    expect(await screen.findByText(/that code has expired/i)).toBeInTheDocument()
  })

  it('stays on the linking panel when the code did not link', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: false })
    linkMock.mockResolvedValue({ linked: false })
    const user = userEvent.setup()

    render(<MiniAppPage />)
    await user.type(await screen.findByLabelText(/connect code/i), 'ABCD2345')
    await user.click(screen.getByRole('button', { name: /connect/i }))

    expect(screen.getByText(/connect your account/i)).toBeInTheDocument()
  })
})

// Regression guard. Sizing the shell from a runtime viewport measurement made
// focusing the composer rescale the page on real devices; bottom spacing is a
// static padding instead, and the shell height is left to the browser.
describe('MiniAppPage — layout stays static', () => {
  it('sizes the shell with the viewport unit, not a measured pixel height', async () => {
    setup()
    sessionMock.mockResolvedValue({ linked: true, company: 'Acme Movers', token: 't', user: {} })

    render(<MiniAppPage />)
    await screen.findByText('chat for Acme Movers')

    const shell = screen.getByRole('main')
    expect(shell.className).toContain('h-screen')
    expect(shell.getAttribute('style')).toBeNull()
  })

  // Checked against the real module, not the mock: the point is that no
  // viewport-measuring helper exists for a caller to reach for in the first place.
  it('exposes no viewport-measuring helper on the Telegram bridge module', async () => {
    const actual = await vi.importActual<typeof import('@/lib/telegramWebApp')>(
      '@/lib/telegramWebApp',
    )

    expect(Object.keys(actual).sort()).toEqual([
      'applyTelegramTheme',
      'loadTelegramWebApp',
      'resetTelegramWebAppLoader',
    ])
  })
})
