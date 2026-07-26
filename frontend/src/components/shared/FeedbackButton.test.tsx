import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackButton from './FeedbackButton'

vi.mock('@/hooks/useFeedback', () => ({
  useSubmitFeedback: vi.fn(),
}))

import { useSubmitFeedback } from '@/hooks/useFeedback'

const mutateMock = vi.fn()
const resetMock = vi.fn()

function mockHook(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useSubmitFeedback).mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    isError: false,
    reset: resetMock,
    ...overrides,
  } as unknown as ReturnType<typeof useSubmitFeedback>)
}

beforeEach(() => {
  mutateMock.mockReset()
  resetMock.mockReset()
  mockHook()
})

describe('FeedbackButton', () => {
  it('renders as a small floating trigger with the form closed', () => {
    render(<FeedbackButton />)
    expect(screen.getByRole('button', { name: /report issue/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the report form with a message field and a severity selector', async () => {
    const user = userEvent.setup()
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/what happened/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
  })

  it('AC — submits message, page URL, and severity, then shows a confirmation', async () => {
    const user = userEvent.setup()
    mutateMock.mockImplementation((_input, opts) => opts?.onSuccess?.({ success: true, id: 'f1' }))
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))
    await user.type(screen.getByPlaceholderText(/what happened/i), 'The invoice PDF is missing the logo')
    await user.selectOptions(screen.getByLabelText(/type/i), 'suggestion')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The invoice PDF is missing the logo',
        severity: 'suggestion',
        pageUrl: expect.any(String),
      }),
      expect.anything(),
    )
    expect(screen.getByText(/thanks, we got it/i)).toBeInTheDocument()
  })

  it('AC — a failed submission shows an error and keeps what was typed', async () => {
    const user = userEvent.setup()
    mockHook({ isError: true })
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))
    await user.type(screen.getByPlaceholderText(/what happened/i), 'Still typed after a failure')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    expect(screen.getByText(/couldn't send/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/what happened/i)).toHaveValue('Still typed after a failure')
  })

  it('disables Submit until a message is typed', async () => {
    const user = userEvent.setup()
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/what happened/i), 'x')
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeEnabled()
  })

  // Regression coverage for the bug this fix addresses: the modal previously
  // used a Sheet anchored to the bottom edge instead of a centered dialog.
  it('centers the modal in the viewport instead of anchoring it to an edge', async () => {
    const user = userEvent.setup()
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))

    const backdrop = screen.getByRole('dialog').parentElement
    expect(backdrop).toHaveClass('items-center', 'justify-center')
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    render(<FeedbackButton />)

    await user.click(screen.getByRole('button', { name: /report issue/i }))
    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on a backdrop click but not on a click inside the dialog', async () => {
    const user = userEvent.setup()
    render(<FeedbackButton />)
    await user.click(screen.getByRole('button', { name: /report issue/i }))

    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement

    await user.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
