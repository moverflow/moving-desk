import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicInvoicePage from './PublicInvoicePage'

vi.mock('@react-pdf/renderer', () => ({
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s: unknown) => s },
  PDFDownloadLink: ({ children }: { children: (p: { loading: boolean }) => React.ReactNode }) =>
    <a href="#">{children({ loading: false })}</a>,
}))

function renderPublic(token = 'mock-token-1') {
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
    }, { timeout: 1000 })
  })

  it('shows company name and client info', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getByText('Best & Pro Moving Service')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('AC2 — Download PDF button present on public page', async () => {
    renderPublic()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /download pdf/i })).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('shows Mark as received button, shows thank you after click', async () => {
    renderPublic()
    await waitFor(() => screen.getByRole('button', { name: /mark as received/i }))
    fireEvent.click(screen.getByRole('button', { name: /mark as received/i }))
    expect(screen.getByText('Thank you!')).toBeInTheDocument()
  })

  it('AC3 — displays total price', async () => {
    renderPublic()
    // $480 appears in both line item and total row
    await waitFor(() => {
      expect(screen.getAllByText('$480').length).toBeGreaterThan(0)
    }, { timeout: 1000 })
  })
})
