import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OrdersPage from './OrdersPage'

function renderOrders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OrdersPage', () => {
  it('AC1 — renders all 4 column headers', async () => {
    renderOrders()
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument()
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
      expect(screen.getByText('In progress')).toBeInTheDocument()
      expect(screen.getByText('Done')).toBeInTheDocument()
    })
  })

  it('AC1 — orders appear in correct columns', async () => {
    renderOrders()
    await waitFor(() => {
      expect(screen.getByText('Rick Adams')).toBeInTheDocument()
      expect(screen.getByText('Tom Wilson')).toBeInTheDocument()
      expect(screen.getByText('Sarah Park')).toBeInTheDocument()
      expect(screen.getByText('James Lee')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('AC5 — clicking a card opens the detail sheet', async () => {
    renderOrders()
    await waitFor(() => screen.getByText('Rick Adams'))
    fireEvent.click(screen.getByText('Rick Adams'))
    await waitFor(() => {
      expect(screen.getAllByText('Rick Adams').length).toBeGreaterThan(1)
    })
  })
})
