import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ClientsPage from './ClientsPage'
import type { Client } from '@/types'
import { ApiError } from '@/lib/api'

vi.mock('@/hooks/useClients', () => ({
  useClients: vi.fn(),
  useUpdateClient: vi.fn(),
  useClient: vi.fn(),
  useCreateClient: vi.fn(),
}))

import { useClients, useUpdateClient, useCreateClient } from '@/hooks/useClients'

const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-1', tenantId: 'mock-tenant-1',
    name: 'Rick Adams', phone: '(949) 632-9557',
    email: 'radams@example.com', notes: 'Prefers morning moves',
    orderCount: 1, createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'client-2', tenantId: 'mock-tenant-1',
    name: 'James Lee', phone: '(714) 555-0142',
    email: 'jlee@example.com', notes: '',
    orderCount: 3, createdAt: '2025-03-15T10:00:00Z',
  },
  {
    id: 'client-3', tenantId: 'mock-tenant-1',
    name: 'Anna Brooks', phone: '(949) 555-0188',
    email: '', notes: 'Has fragile antiques',
    orderCount: 2, createdAt: '2025-08-20T10:00:00Z',
  },
  {
    id: 'client-4', tenantId: 'mock-tenant-1',
    name: 'Tom Wilson', phone: '(310) 555-0177',
    email: 'twilson@example.com', notes: '',
    orderCount: 1, createdAt: '2026-05-30T10:00:00Z',
  },
]

function filterClients(search: string) {
  if (!search) return MOCK_CLIENTS
  const q = search.toLowerCase()
  return MOCK_CLIENTS.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
}

function renderClients(createClientMock?: ReturnType<typeof useCreateClient>) {
  vi.mocked(useClients).mockImplementation((s) =>
    ({ data: filterClients(s ?? ''), isLoading: false } as unknown as ReturnType<typeof useClients>)
  )
  vi.mocked(useUpdateClient).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateClient>)
  vi.mocked(useCreateClient).mockReturnValue(
    createClientMock ?? ({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCreateClient>)
  )

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/clients']}>
        <Routes>
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/new-order" element={<div>new order page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClientsPage', () => {
  it('renders all mock clients', async () => {
    renderClients()
    await waitFor(() => {
      expect(screen.getByText('Rick Adams')).toBeInTheDocument()
      expect(screen.getByText('James Lee')).toBeInTheDocument()
      expect(screen.getByText('Anna Brooks')).toBeInTheDocument()
      expect(screen.getByText('Tom Wilson')).toBeInTheDocument()
    })
  })

  it('AC1 — search filters clients by name', async () => {
    renderClients()
    await waitFor(() => screen.getByText('Rick Adams'))
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'rick' } })
    await waitFor(() => {
      expect(screen.getByText('Rick Adams')).toBeInTheDocument()
      expect(screen.queryByText('Tom Wilson')).not.toBeInTheDocument()
    })
  })

  it('AC1 — search filters clients by phone', async () => {
    renderClients()
    await waitFor(() => screen.getByText('Rick Adams'))
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '(714)' } })
    await waitFor(() => {
      expect(screen.getByText('James Lee')).toBeInTheDocument()
      expect(screen.queryByText('Rick Adams')).not.toBeInTheDocument()
    })
  })

  it('AC2 — New order button navigates to /new-order', async () => {
    renderClients()
    await waitFor(() => screen.getAllByRole('button', { name: /new order/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /new order/i })[0])
    await waitFor(() => {
      expect(screen.getByText('new order page')).toBeInTheDocument()
    })
  })

  it('shows table column headers', async () => {
    renderClients()
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Phone')).toBeInTheDocument()
      expect(screen.getByText('Last move')).toBeInTheDocument()
      expect(screen.getByText('Orders')).toBeInTheDocument()
    })
  })

  it('AC3 — Add client button opens panel, valid submit calls createClient and closes panel', async () => {
    const mutate = vi.fn((_vars, opts: { onSuccess?: () => void }) => opts.onSuccess?.())
    renderClients({ mutate, isPending: false } as unknown as ReturnType<typeof useCreateClient>)
    await waitFor(() => screen.getByText('Rick Adams'))

    fireEvent.click(screen.getByRole('button', { name: /add client/i }))
    await waitFor(() => screen.getByLabelText('Name'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Person' } })
    fireEvent.click(screen.getByRole('button', { name: /save client/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { name: 'New Person', phone: undefined, email: undefined, notes: undefined },
        expect.any(Object),
      )
    })
    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    })
  })

  it('AC4 — duplicate phone shows inline error under phone field, panel stays open', async () => {
    const mutate = vi.fn((_vars, opts: { onError?: (err: unknown) => void }) =>
      opts.onError?.(new ApiError(409, 'Client with this phone already exists')),
    )
    renderClients({ mutate, isPending: false } as unknown as ReturnType<typeof useCreateClient>)
    await waitFor(() => screen.getByText('Rick Adams'))

    fireEvent.click(screen.getByRole('button', { name: /add client/i }))
    await waitFor(() => screen.getByLabelText('Name'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dup Name' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '(949) 555-0188' } })
    fireEvent.click(screen.getByRole('button', { name: /save client/i }))

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })
})
