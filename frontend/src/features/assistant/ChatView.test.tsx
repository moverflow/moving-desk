import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  AssistantInvoice,
  AssistantJob,
  AssistantPendingAction,
  AssistantTranscript,
} from '@/types'
import ChatView from './ChatView'

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantTranscript: vi.fn(),
  useSendAssistantMessage: vi.fn(),
  useResolveAssistantAction: vi.fn(),
}))

import {
  useAssistantTranscript,
  useResolveAssistantAction,
  useSendAssistantMessage,
} from '@/hooks/useAssistant'

const sendMock = vi.fn()
const resolveMock = vi.fn()

const JOB: AssistantJob = {
  id: 'job-1',
  reference: '#44444444',
  status: 'confirmed',
  moveDate: '2026-09-01',
  fromAddress: '1 A St, Irvine',
  toAddress: '2 B St, Tustin',
  homeSize: '2br',
  packing: true,
  totalPrice: 600,
  clientName: 'Jane Smith',
  clientPhone: '9495550100',
  crewName: 'Truck 2',
}

const INVOICE: AssistantInvoice = {
  id: 'inv-1',
  number: '1001',
  status: 'sent',
  totalPrice: 620,
  moveDate: '2026-08-05',
  clientName: 'Bob Jones',
  clientPhone: '9495550111',
  sentAt: '2026-08-01T12:00:00.000Z',
  dueLabel: 'Sent Aug 1, 2026',
}

const PENDING: AssistantPendingAction = {
  messageId: 'msg-2',
  toolUseId: 'toolu_1',
  tool: 'createJob',
  summary: 'Create a job for Jane Smith on 2026-09-01: 1 A St → 2 B St',
}

interface SetupOptions {
  transcript?: AssistantTranscript
  isLoading?: boolean
  sending?: boolean
  resolving?: boolean
  sendError?: unknown
}

function setup(options: SetupOptions = {}): void {
  vi.mocked(useAssistantTranscript).mockReturnValue({
    data: options.transcript ?? { messages: [], pendingAction: null },
    isLoading: options.isLoading ?? false,
  } as unknown as ReturnType<typeof useAssistantTranscript>)

  vi.mocked(useSendAssistantMessage).mockReturnValue({
    mutate: sendMock,
    isPending: options.sending ?? false,
    error: options.sendError ?? null,
  } as unknown as ReturnType<typeof useSendAssistantMessage>)

  vi.mocked(useResolveAssistantAction).mockReturnValue({
    mutate: resolveMock,
    isPending: options.resolving ?? false,
    error: null,
  } as unknown as ReturnType<typeof useResolveAssistantAction>)
}

beforeEach(() => {
  sendMock.mockReset()
  resolveMock.mockReset()
})

describe('ChatView — conversation', () => {
  it('shows the company name in the header', () => {
    setup()
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('Acme Movers')).toBeInTheDocument()
  })

  it('offers starter prompts on an empty conversation and sends one when tapped', async () => {
    setup()
    const user = userEvent.setup()
    render(<ChatView company="Acme Movers" />)

    await user.click(screen.getByRole('button', { name: /which invoices are unpaid/i }))

    expect(sendMock).toHaveBeenCalledWith('Which invoices are unpaid?')
  })

  it('renders user and assistant turns', () => {
    setup({
      transcript: {
        messages: [
          { id: 'm1', role: 'user', text: 'what is on today?', results: [] },
          { id: 'm2', role: 'assistant', text: 'One job today.', results: [] },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('what is on today?')).toBeInTheDocument()
    expect(screen.getByText('One job today.')).toBeInTheDocument()
  })

  it('sends a typed message and clears the box', async () => {
    setup()
    const user = userEvent.setup()
    render(<ChatView company="Acme Movers" />)

    const box = screen.getByLabelText(/message the assistant/i)
    await user.type(box, 'book a move')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(sendMock).toHaveBeenCalledWith('book a move')
    expect(box).toHaveValue('')
  })

  it('will not send an empty or whitespace-only message', async () => {
    setup()
    const user = userEvent.setup()
    render(<ChatView company="Acme Movers" />)

    await user.type(screen.getByLabelText(/message the assistant/i), '   ')

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('surfaces a send failure', () => {
    setup({ sendError: new Error('boom') })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})

describe('ChatView — inline result cards', () => {
  it('renders a job card rather than raw text', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'One job on Sep 1.',
            results: [{ tool: 'listUpcomingJobs', ok: true, data: [JOB], error: null }],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('#44444444')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    // US formats: $600, "Sep 1, 2026", (949) 555-0100.
    expect(screen.getByText('$600')).toBeInTheDocument()
    expect(screen.getByText('Sep 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('(949) 555-0100')).toBeInTheDocument()
    expect(screen.getByText('Truck 2')).toBeInTheDocument()
  })

  it('renders an invoice card', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'One unpaid invoice.',
            results: [{ tool: 'listUnpaidInvoices', ok: true, data: [INVOICE], error: null }],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('#1001')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('$620')).toBeInTheDocument()
    expect(screen.getByText(/Sent Aug 1, 2026/)).toBeInTheDocument()
  })

  it('renders a client card with a job count', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'Found one.',
            results: [
              {
                tool: 'findClient',
                ok: true,
                data: [
                  { id: 'c1', name: 'Jane Smith', phone: '9495550100', email: null, jobCount: 1 },
                ],
                error: null,
              },
            ],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('1 job')).toBeInTheDocument()
  })

  it('says so when a lookup found nothing instead of rendering an empty list', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'Nothing outstanding.',
            results: [{ tool: 'listUnpaidInvoices', ok: true, data: [], error: null }],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText(/no unpaid invoices/i)).toBeInTheDocument()
  })

  it('shows a tool failure as an error, not as data', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'It has to be confirmed first.',
            results: [
              {
                tool: 'setJobStatus',
                ok: false,
                data: null,
                error: 'A job cannot go from "new" to "closed".',
              },
            ],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText(/cannot go from "new" to "closed"/)).toBeInTheDocument()
  })

  it('renders the resulting job after a confirmed write', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'Created.',
            results: [{ tool: 'createJob', ok: true, data: JOB, error: null }],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText('#44444444')).toBeInTheDocument()
  })

  it('ignores a payload whose shape does not match its tool', () => {
    setup({
      transcript: {
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            text: 'Here you go.',
            results: [{ tool: 'listUpcomingJobs', ok: true, data: 'not an array', error: null }],
          },
        ],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    // Falls back to the empty-state line rather than throwing.
    expect(screen.getByText(/no jobs in that window/i)).toBeInTheDocument()
  })
})

describe('ChatView — confirmation before a write', () => {
  const withPending: AssistantTranscript = {
    messages: [{ id: 'm1', role: 'user', text: 'book the Smiths', results: [] }],
    pendingAction: PENDING,
  }

  it('shows what will happen and asks for an explicit OK', () => {
    setup({ transcript: withPending })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByRole('region', { name: /confirm action/i })).toBeInTheDocument()
    expect(screen.getByText(/needs your ok/i)).toBeInTheDocument()
    expect(screen.getByText('Create a job')).toBeInTheDocument()
    expect(screen.getByText(PENDING.summary)).toBeInTheDocument()
  })

  it('confirms the held action when the user taps Confirm', async () => {
    setup({ transcript: withPending })
    const user = userEvent.setup()
    render(<ChatView company="Acme Movers" />)

    await user.click(screen.getByRole('button', { name: /^confirm$/i }))

    expect(resolveMock).toHaveBeenCalledWith({ action: PENDING, decision: 'confirm' })
  })

  it('declines the held action when the user taps Cancel', async () => {
    setup({ transcript: withPending })
    const user = userEvent.setup()
    render(<ChatView company="Acme Movers" />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(resolveMock).toHaveBeenCalledWith({ action: PENDING, decision: 'reject' })
  })

  // The proposal is a question; typing past it would strand it in the transcript.
  it('blocks the composer until the action is answered', () => {
    setup({ transcript: withPending })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByLabelText(/message the assistant/i)).toBeDisabled()
    expect(screen.getByPlaceholderText(/answer above to continue/i)).toBeInTheDocument()
  })

  it('disables both buttons while the decision is in flight', () => {
    setup({ transcript: withPending, resolving: true })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows no confirmation card when nothing is pending', () => {
    setup({
      transcript: {
        messages: [{ id: 'm1', role: 'assistant', text: 'Two jobs today.', results: [] }],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    expect(screen.queryByRole('region', { name: /confirm action/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/message the assistant/i)).not.toBeDisabled()
  })
})

describe('ChatView — busy states', () => {
  it('shows a thinking indicator and blocks input while sending', () => {
    setup({ sending: true })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/message the assistant/i)).toBeDisabled()
  })

  it('shows a loading line before the transcript arrives', () => {
    setup({ isLoading: true })
    render(<ChatView company="Acme Movers" />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

// Asserted on the class rather than a computed style because jsdom does not
// resolve calc() against a CSS variable.
describe('ChatView — bottom spacing', () => {
  it('pads the composer clear of the bottom edge', () => {
    setup()
    render(<ChatView company="Acme Movers" />)

    const composer = screen.getByLabelText(/message the assistant/i).parentElement
    expect(composer?.className).toContain('pb-[calc(1rem+var(--tg-safe-bottom))]')
  })

  // The spacing is a static padding plus an optional inset. Nothing measures the
  // viewport, because doing so is what made focusing the input rescale the page.
  it('does not depend on any runtime viewport measurement', () => {
    setup()
    render(<ChatView company="Acme Movers" />)

    const composer = screen.getByLabelText(/message the assistant/i).parentElement
    expect(composer?.className).not.toContain('tg-app-height')
  })

  it('leaves room under the last message so it does not sit on the composer', () => {
    setup({
      transcript: {
        messages: [{ id: 'm1', role: 'assistant', text: 'One job today.', results: [] }],
        pendingAction: null,
      },
    })
    render(<ChatView company="Acme Movers" />)

    const scroller = screen.getByText('One job today.').closest('.overflow-y-auto')
    expect(scroller?.className).toContain('pb-6')
  })
})
