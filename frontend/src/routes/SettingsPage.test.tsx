import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { useAuthStore } from '@/store/auth.store'
import { MOCK_USER, MOCK_TENANT } from '@/store/auth.store'

function renderSettings() {
  useAuthStore.getState().setAuth(MOCK_USER, MOCK_TENANT)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Routes><Route path="*" element={<SettingsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

describe('SettingsPage', () => {
  it('renders three tab triggers', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /company/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /billing/i })).toBeInTheDocument()
  })

  it('Company tab is active by default', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /company/i })).toHaveAttribute('data-state', 'active')
  })

  it('AC2 — base rates section visible on company tab', async () => {
    renderSettings()
    await waitFor(() => expect(screen.getByText('Base rates')).toBeInTheDocument())
  })

  it('AC1 — logo upload input present on company tab', () => {
    renderSettings()
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('AC3 — team tab shows team members after click', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('AC3 — team tab shows invite button', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('AC5 — billing tab shows plan info', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /billing/i }))
    await waitFor(() => {
      expect(screen.getByText('Current plan')).toBeInTheDocument()
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('AC3 — can invite a new team member', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('tab', { name: /team/i }))
    await waitFor(() => screen.getByPlaceholderText(/teammate/i), { timeout: 2000 })
    await user.type(screen.getByPlaceholderText(/teammate/i), 'new@team.com')
    await user.click(screen.getByRole('button', { name: /^invite$/i }))
    await waitFor(() => {
      expect(screen.getByText('Invite sent!')).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
