import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Kanban, Plus, Receipt, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/orders', label: 'Orders', Icon: Kanban },
  { to: '/new-order', label: 'New order', Icon: Plus },
  { to: '/invoices', label: 'Invoices', Icon: Receipt },
  { to: '/clients', label: 'Clients', Icon: Users },
]

export default function AppShell(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="h-11 flex items-center justify-between px-4 sticky top-0 bg-white z-10"
        style={{ borderBottom: '0.5px solid #e5e7eb' }}
      >
        <span className="text-sm font-medium select-none">
          Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
        </span>

        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                  isActive
                    ? 'bg-gray-100 font-semibold text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                )
              }
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ backgroundColor: '#1d9e75' }}
        >
          MD
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
