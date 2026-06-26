import { describe, it, expect, vi } from 'vitest'
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
  useUpdateInvoiceStatus: vi.fn(),
}))

import { usePublicInvoice, useUpdateInvoiceStatus } from '@/hooks/useInvoices'

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

function renderPublic(token = 'mock-token-1') {
  vi.mocked(usePublicInvoice).mockReturnValue({
    data: { invoice: MOCK_INVOICE, company: MOCK_COMPANY },
    isLoading: false,
  } as ReturnType<typeof usePublicInvoice>)
  vi.mocked(useUpdateInvoiceStatus).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateInvoiceStatus>)

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/i/${token}`]}>
        <Routes>
          <Route path="/i/:token" element={<PublicInvoicePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicInvoicePage', () => {
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

  it('shows Mark as received button, shows thank you after click', async () => {
    renderPublic()
    await waitFor(() => screen.getByRole('button', { name: /mark as received/i }))
    fireEvent.click(screen.getByRole('button', { name: /mark as received/i }))
    expect(screen.getByText('Thank you!')).toBeInTheDocument()
  })

  it('AC3 — displays total price', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getAllByText('$480').length).toBeGreaterThan(0)
    })
  })
})
