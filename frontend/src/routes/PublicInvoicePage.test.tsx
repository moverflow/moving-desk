import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicInvoicePage from './PublicInvoicePage'
import type { Invoice, Company } from '@/types'

vi.mock('@react-pdf/renderer', () => ({
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({ children }: { children: (p: { loading: boolean }) => React.ReactNode }) =>
    <a href="#">{children({ loading: false })}</a>,
}))

vi.mock('@/hooks/useInvoices', () => ({
  usePublicInvoice: vi.fn(),
  useCreatePaymentLink: vi.fn(),
}))

import { usePublicInvoice, useCreatePaymentLink } from '@/hooks/useInvoices'

const MOCK_INVOICE: Invoice = {
  id: 'inv-1', tenantId: '', orderId: 'order-1',
  number: 'INV-1089', status: 'draft',
  clientName: 'Rick Adams', clientPhone: '(949) 632-9557', clientEmail: 'rick@example.com',
  fromAddress: 'Lake Forest, CA', toAddress: 'Anaheim, CA',
  moveDate: '2026-06-15', homeSize: '2 BR', packing: false,
  basePrice: 480, totalPrice: 480, shareToken: 'mock-token-1',
  createdAt: '2026-06-01T10:00:00Z',
}

const MOCK_COMPANY: Company = {
  name: 'Best & Pro Moving Service',
  phone: '(714) 555-0199',
  website: 'bestpro-moving.com',
  logoUrl: null,
}

const mutateAsync = vi.fn()

function renderPublic(invoice: Invoice = MOCK_INVOICE, isPending = false) {
  vi.mocked(usePublicInvoice).mockReturnValue({
    data: { invoice, company: MOCK_COMPANY },
    isLoading: false,
  } as ReturnType<typeof usePublicInvoice>)
  vi.mocked(useCreatePaymentLink).mockReturnValue({
    mutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useCreatePaymentLink>)

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/i/mock-token-1']}>
        <Routes>
          <Route path="/i/:token" element={<PublicInvoicePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicInvoicePage', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  it('AC3 — renders invoice data without auth', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getByText('INV-1089')).toBeInTheDocument()
    })
  })

  it('shows company name and client info', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getByText('Best & Pro Moving Service')).toBeInTheDocument()
    })
  })

  it('AC2 — Download PDF button present on public page', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /download pdf/i })).toBeInTheDocument()
    })
  })

  it('AC3 — displays total price', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getAllByText('$480').length).toBeGreaterThan(0)
    })
  })

  it('AC8 — Pay now NOT shown when status is draft', async () => {
    renderPublic({ ...MOCK_INVOICE, status: 'draft' })
    await waitFor(() => screen.getByText('INV-1089'))
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument()
  })

  it('AC1 — Pay now shown when status is sent', async () => {
    renderPublic({ ...MOCK_INVOICE, status: 'sent' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument()
    })
  })

  it('AC9/AC7 — Payment received shown when paid, no Pay now', async () => {
    renderPublic({ ...MOCK_INVOICE, status: 'paid', paidAt: '2026-06-15T12:00:00Z' })
    await waitFor(() => {
      expect(screen.getByText(/payment received/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/paid on/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument()
  })

  it('AC11 — Pay now disabled while session is being created', async () => {
    renderPublic({ ...MOCK_INVOICE, status: 'sent' }, true)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /redirecting/i })).toBeDisabled()
    })
  })

  it('AC2 — clicking Pay now creates a session with the share token', async () => {
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } })
    mutateAsync.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_123')
    renderPublic({ ...MOCK_INVOICE, status: 'sent' })
    fireEvent.click(await screen.findByRole('button', { name: /pay now/i }))
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('mock-token-1')
    })
  })

  it('AC10 — shows error when session creation fails', async () => {
    mutateAsync.mockRejectedValue(new Error('Stripe unavailable'))
    renderPublic({ ...MOCK_INVOICE, status: 'sent' })
    fireEvent.click(await screen.findByRole('button', { name: /pay now/i }))
    await waitFor(() => {
      expect(screen.getByText('Stripe unavailable')).toBeInTheDocument()
    })
  })
})
