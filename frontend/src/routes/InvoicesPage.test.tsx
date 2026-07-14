import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InvoicesPage from './InvoicesPage'
import type { Invoice } from '@/types'

vi.mock('@react-pdf/renderer', () => ({
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({ children }: { children: (p: { loading: boolean }) => React.ReactNode }) =>
    <a href="#">{children({ loading: false })}</a>,
}))

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
}))

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  useGenerateInvoice: vi.fn(),
  useUpdateInvoiceStatus: vi.fn(),
  useSendInvoice: vi.fn(),
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
  useSubscription: vi.fn(),
}))

import { useInvoices, useGenerateInvoice, useUpdateInvoiceStatus, useSendInvoice } from '@/hooks/useInvoices'
import { useOrders } from '@/hooks/useOrders'
import { useSettings, useSubscription } from '@/hooks/useSettings'
import type { Order } from '@/types'

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1', tenantId: 'mock-tenant-1', orderId: 'order-1',
    number: 'INV-1089', status: 'draft',
    clientName: 'Rick Adams', clientPhone: '(949) 632-9557', clientEmail: 'rick@example.com',
    fromAddress: 'Lake Forest, CA', toAddress: 'Anaheim, CA',
    moveDate: '2026-06-15', homeSize: '2 BR', packing: false,
    basePrice: 480, totalPrice: 480, shareToken: 'mock-token-1',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'inv-2', tenantId: 'mock-tenant-1', orderId: 'order-2',
    number: 'INV-1088', status: 'sent',
    clientName: 'Tom Wilson', clientPhone: '(310) 555-0177', clientEmail: 'tom@example.com',
    fromAddress: 'Newport Beach, CA', toAddress: 'Los Angeles, CA',
    moveDate: '2026-06-20', homeSize: 'House', packing: true,
    basePrice: 850, totalPrice: 1100, shareToken: 'mock-token-2',
    sentAt: '2026-06-02T11:00:00Z', createdAt: '2026-06-02T10:00:00Z',
  },
  {
    id: 'inv-3', tenantId: 'mock-tenant-1', orderId: 'order-4',
    number: 'INV-1087', status: 'paid',
    clientName: 'James Lee', clientPhone: '(714) 555-0142', clientEmail: 'james@example.com',
    fromAddress: 'Tustin, CA', toAddress: 'Yorba Linda, CA',
    moveDate: '2026-06-10', homeSize: '2 BR', packing: false,
    basePrice: 480, totalPrice: 480, shareToken: 'mock-token-3',
    sentAt: '2026-06-10T15:00:00Z', paidAt: '2026-06-11T09:00:00Z',
    createdAt: '2026-06-10T14:00:00Z',
  },
]

const MOCK_COMPANY = { name: 'Best & Pro Moving Service', phone: '(714) 555-0199', website: 'bestpro-moving.com', logoUrl: null }

const MOCK_ELIGIBLE_ORDER: Order = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenantId: 'mock-tenant-1',
  clientName: 'Rick Adams',
  phone: '(949) 632-9557',
  fromAddress: 'Lake Forest, CA',
  toAddress: 'Anaheim, CA',
  moveDate: '2026-06-15',
  homeSize: '2br',
  status: 'completed',
  fromFloor: 1,
  toFloor: 1,
  fromElevator: false,
  toElevator: false,
  packing: false,
  totalPrice: 480,
  createdAt: '2026-06-01T10:00:00Z',
  isOnline: false,
  contractStatus: 'none',
}

function renderInvoices() {
  vi.mocked(useInvoices).mockReturnValue({ data: MOCK_INVOICES, isLoading: false } as ReturnType<typeof useInvoices>)
  vi.mocked(useOrders).mockReturnValue({ data: [MOCK_ELIGIBLE_ORDER], isLoading: false } as ReturnType<typeof useOrders>)
  vi.mocked(useGenerateInvoice).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useGenerateInvoice>)
  vi.mocked(useUpdateInvoiceStatus).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateInvoiceStatus>)
  vi.mocked(useSendInvoice).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSendInvoice>)
  vi.mocked(useSettings).mockReturnValue({ data: { companyName: MOCK_COMPANY.name, logoUrl: null, timezone: 'America/New_York', baseRates: {} } } as ReturnType<typeof useSettings>)
  vi.mocked(useSubscription).mockReturnValue({ data: { plan: 'trial', status: 'trialing' } } as ReturnType<typeof useSubscription>)

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<InvoicesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InvoicesPage', () => {
  it('renders the invoices list after loading', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getAllByText('INV-1089').length).toBeGreaterThan(0)
      expect(screen.getByText('INV-1088')).toBeInTheDocument()
      expect(screen.getByText('INV-1087')).toBeInTheDocument()
    })
  })

  it('AC5 — shows status badges for all statuses', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0)
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.getByText('Paid')).toBeInTheDocument()
    })
  })

  it('AC1 — Generate button is present', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
    })
  })

  it('AC5 — clicking an invoice shows its detail', async () => {
    renderInvoices()
    await waitFor(() => screen.getByText('INV-1088'))
    fireEvent.click(screen.getByText('INV-1088'))
    await waitFor(() => {
      expect(screen.getAllByText('INV-1088').length).toBeGreaterThan(1)
    })
  })

  it('AC2 — Download PDF button is present in detail', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /download pdf/i })).toBeInTheDocument()
    })
  })

  it('AC3 — Copy share link button is present', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument()
    })
  })
})
