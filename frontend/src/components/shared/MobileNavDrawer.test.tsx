import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Kanban, Users } from 'lucide-react'
import MobileNavDrawer, { type MobileNavItem } from './MobileNavDrawer'

const ITEMS: MobileNavItem[] = [
  { to: '/orders', label: 'Orders', Icon: Kanban },
  { to: '/clients', label: 'Clients', Icon: Users },
]

function renderDrawer(initialPath = '/orders') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<MobileNavDrawer items={ITEMS} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MobileNavDrawer', () => {
  it('is closed by default — nav items are not in the document', () => {
    renderDrawer()
    expect(screen.queryByRole('link', { name: /orders/i })).not.toBeInTheDocument()
  })

  it('opens on hamburger click and lists every item passed in, not a hand-maintained subset', () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clients/i })).toBeInTheDocument()
  })

  it('closes after a nav link is clicked', () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    fireEvent.click(screen.getByRole('link', { name: /clients/i }))
    expect(screen.queryByRole('link', { name: /clients/i })).not.toBeInTheDocument()
  })
})
