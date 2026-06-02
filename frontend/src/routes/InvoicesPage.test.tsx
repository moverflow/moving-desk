import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InvoicesPage from './InvoicesPage'

// @react-pdf/renderer uses browser APIs unavailable in jsdom
vi.mock('@react-pdf/renderer', () => ({
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({ children }: { children: (p: { loading: boolean }) => React.ReactNode }) =>
    <a href="#">{children({ loading: false })}</a>,
}))

function renderInvoices() {
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
      // INV-1089 appears in both list + detail (first invoice auto-selected)
      expect(screen.getAllByText('INV-1089').length).toBeGreaterThan(0)
      expect(screen.getByText('INV-1088')).toBeInTheDocument()
      expect(screen.getByText('INV-1087')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('AC5 — shows status badges for all statuses', async () => {
    renderInvoices()
    await waitFor(() => {
      // Draft appears in list badge + detail select trigger
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0)
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.getByText('Paid')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('AC1 — Generate button is present', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
    }, { timeout: 1000 })
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
    }, { timeout: 1000 })
  })

  it('AC3 — Copy share link button is present', async () => {
    renderInvoices()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
