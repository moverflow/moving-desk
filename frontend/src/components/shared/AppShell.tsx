import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Kanban, Plus, Receipt, Users, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useSettings } from '@/hooks/useSettings'
import TrialBanner from '@/components/shared/TrialBanner'

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

function NavTab({ to, label, Icon }: NavItem): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }: { isActive: boolean }) =>
        cn(
          'flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium transition-colors',
          isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
        )
      }
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )
}

export default function AppShell(): JSX.Element {
  const { user } = useAuthStore()
  const { data: settings } = useSettings()

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="h-[60px] flex items-center justify-between px-8 sticky top-0 bg-white z-10"
        style={{ borderBottom: '0.5px solid #e5e7eb' }}
      >
        <div className="flex items-center gap-2">
          {settings?.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Company logo"
              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <span
            className="text-base font-semibold select-none"
            style={{ letterSpacing: '-0.01em' }}
          >
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
          </span>
        </div>
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => <NavTab key={item.to} {...item} />)}
          {user?.role === 'owner' && <NavTab to="/settings" label="Settings" Icon={SettingsIcon} />}
        </nav>
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
          style={{ backgroundColor: '#1d9e75', fontSize: 12 }}
        >
          MD
        </div>
      </header>
      <TrialBanner />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
