import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PaySuccessPage from './PaySuccessPage'
import type { Invoice, Company } from '@/types'

vi.mock('@/hooks/useInvoices', () => ({
  usePublicInvoice: vi.fn(),
}))

import { usePublicInvoice } from '@/hooks/useInvoices'

const MOCK_COMPANY: Company = {
  name: 'Best & Pro Moving Service',
  phone: '(714) 555-0199',
  website: 'bestpro-moving.com',
  logoUrl: null,
}

function mockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    tenantId: '',
    orderId: 'order-1',
    number: 'INV-1089',
    status: 'sent',
    clientName: 'Rick Adams',
    clientPhone: '(949) 632-9557',
    clientEmail: '',
    fromAddress: 'Lake Forest, CA',
    toAddress: 'Anaheim, CA',
    moveDate: '2026-06-15',
    homeSize: '2br',
    packing: false,
    basePrice: 480,
    totalPrice: 480,
    shareToken: 'mock-token-1',
    createdAt: '2026-06-01T10:00:00Z',
    ...overrides,
  }
}

function renderPaySuccess(query: `?${string}` = '?session_id=cs_123&token=mock-token-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/pay/success${query}`]}>
        <Routes>
          <Route path="/pay/success" element={<PaySuccessPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PaySuccessPage', () => {
  beforeEach(() => {
    vi.mocked(usePublicInvoice).mockReset()
  })

  it('S2 — shows a processing state while the invoice is still "sent" (webhook not landed yet)', async () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: { invoice: mockInvoice({ status: 'sent' }), company: MOCK_COMPANY },
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess()

    await waitFor(() => {
      expect(screen.getByText(/processing your payment/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument()
  })

  it('S2 — shows success only once the invoice is actually paid', async () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: { invoice: mockInvoice({ status: 'paid', paidAt: '2026-06-15T12:00:00Z' }), company: MOCK_COMPANY },
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess()

    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument()
    })
  })

  it('S2 — polls with the token from the URL, not a hardcoded value', () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: { invoice: mockInvoice({ status: 'sent' }), company: MOCK_COMPANY },
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess('?session_id=cs_123&token=abc-token-xyz')

    expect(usePublicInvoice).toHaveBeenCalledWith('abc-token-xyz', { pollUntilResolved: true })
  })

  it('S2 — shows an error state, not a false success, when there is no token at all', async () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: undefined,
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess('?session_id=cs_123')

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument()
  })

  it('S2 — surfaces a refunded/disputed status instead of claiming success', async () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: { invoice: mockInvoice({ status: 'refunded' }), company: MOCK_COMPANY },
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess()

    await waitFor(() => {
      expect(screen.getByText(/payment status changed/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument()
  })

  it('does not render the dead "Close this page" button', async () => {
    vi.mocked(usePublicInvoice).mockReturnValue({
      data: { invoice: mockInvoice({ status: 'paid' }), company: MOCK_COMPANY },
      isError: false,
    } as ReturnType<typeof usePublicInvoice>)

    renderPaySuccess()

    await waitFor(() => screen.getByText(/payment successful/i))
    expect(screen.queryByRole('button', { name: /close this page/i })).not.toBeInTheDocument()
  })
})
