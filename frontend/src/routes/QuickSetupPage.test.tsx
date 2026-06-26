import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import QuickSetupPage from './QuickSetupPage'

vi.mock('@/hooks/useSettings', () => ({
  useUpdateSettings: vi.fn(),
  useUploadLogo: vi.fn(),
}))

import { useUpdateSettings, useUploadLogo } from '@/hooks/useSettings'

function renderSetup() {
  vi.mocked(useUpdateSettings).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateSettings>)
  vi.mocked(useUploadLogo).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ url: 'https://example.com/logo.png' }),
    isPending: false,
  } as unknown as ReturnType<typeof useUploadLogo>)

  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/setup']}>
        <Routes>
          <Route path="/setup" element={<QuickSetupPage />} />
          <Route path="/orders" element={<div>orders page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('QuickSetupPage', () => {
  it('renders step indicator and title', () => {
    renderSetup()
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('One quick thing before you start')).toBeInTheDocument()
  })

  it('renders timezone select with default America/New_York', () => {
    renderSetup()
    const matches = screen.getAllByText('America/New_York (ET)')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('AC6 — "Skip setup" link navigates to /orders', async () => {
    renderSetup()
    fireEvent.click(screen.getByRole('button', { name: /skip setup/i }))
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })

  it('"Skip for now" link navigates to /orders', async () => {
    renderSetup()
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })

  it('submit button navigates to /orders', async () => {
    renderSetup()
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }))
    await waitFor(() => {
      expect(screen.getByText('orders page')).toBeInTheDocument()
    })
  })

  it('AC5 — logo file input is present', () => {
    renderSetup()
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', 'image/*')
  })
})
