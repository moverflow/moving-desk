import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import NewOrderPage from './NewOrderPage'
import type { Client } from '@/types'

vi.mock('@/hooks/useOrders', () => ({
  useCreateOrder: vi.fn(),
}))

vi.mock('@/hooks/useCrews', () => ({
  useCrews: vi.fn(),
}))

vi.mock('@/hooks/useClients', () => ({
  useClientByPhone: vi.fn(),
}))

import { useCreateOrder } from '@/hooks/useOrders'
import { useCrews } from '@/hooks/useCrews'
import { useClientByPhone } from '@/hooks/useClients'

const MOCK_CLIENT: Client = {
  id: 'client-1', tenantId: 'mock-tenant-1',
  name: 'Rick Adams', phone: '(949) 632-9557',
  email: 'radams@example.com', notes: '',
  orderCount: 1, createdAt: '2026-06-01T10:00:00Z',
}

beforeEach(() => {
  vi.mocked(useClientByPhone).mockReturnValue({ data: null } as ReturnType<typeof useClientByPhone>)
  vi.mocked(useCrews).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useCrews>)
  vi.mocked(useCreateOrder).mockReturnValue({
    mutate: vi.fn((_data, opts) => opts?.onSuccess?.({})),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateOrder>)
})

function renderNewOrder() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/new-order']}>
        <Routes>
          <Route path="/new-order" element={<NewOrderPage />} />
          <Route path="/orders" element={<div>orders board</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NewOrderPage', () => {
  it('renders all required form fields', () => {
    renderNewOrder()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/from address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/to address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/move date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
  })

  it('AC3 — size pills update live price', () => {
    renderNewOrder()
    const houseBtn = screen.getByRole('button', { name: 'House' })
    fireEvent.click(houseBtn)
    expect(screen.getByText('$850')).toBeInTheDocument()
  })

  it('AC3 — default price shown for 2BR', () => {
    renderNewOrder()
    expect(screen.getByText('$480')).toBeInTheDocument()
  })

  it('AC2 — phone blur auto-fills client name when client found', async () => {
    vi.mocked(useClientByPhone).mockReturnValue({ data: MOCK_CLIENT } as ReturnType<typeof useClientByPhone>)
    renderNewOrder()
    const phoneInput = screen.getByLabelText(/phone/i)
    fireEvent.change(phoneInput, { target: { value: '(949) 632-9557' } })
    fireEvent.blur(phoneInput)
    await waitFor(() => {
      const clientInput = screen.getByLabelText(/client name/i) as HTMLInputElement
      expect(clientInput.value).toBe('Rick Adams')
    })
  })

  it('AC4 — submitting form navigates to /orders', async () => {
    renderNewOrder()
    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Test Client' } })
    fireEvent.change(screen.getByLabelText(/from address/i), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText(/to address/i), { target: { value: '456 Oak Ave' } })
    fireEvent.change(screen.getByLabelText(/move date/i), { target: { value: '2026-07-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save order/i }))
    await waitFor(() => {
      expect(screen.getByText('orders board')).toBeInTheDocument()
    })
  })
})
