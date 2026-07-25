import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Kanban, LayoutDashboard, Plus, Receipt, Users, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import MobileNavDrawer, { type MobileNavItem } from '@/components/shared/MobileNavDrawer'
import NotificationBell from '@/components/shared/NotificationBell'
import TrialBanner from '@/components/shared/TrialBanner'
import UserMenu from '@/components/shared/UserMenu'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/orders', label: 'Orders', Icon: Kanban },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/new-order', label: 'New order', Icon: Plus },
  { to: '/invoices', label: 'Invoices', Icon: Receipt },
  { to: '/clients', label: 'Clients', Icon: Users },
]

function buildMobileNavItems(isOwner: boolean): MobileNavItem[] {
  return [
    ...(isOwner ? [{ to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }] : []),
    ...NAV_ITEMS,
    ...(isOwner ? [{ to: '/settings', label: 'Settings', Icon: SettingsIcon }] : []),
  ]
}

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
  const isOwner = user?.role === 'owner'

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="h-[60px] flex items-center justify-between gap-2 px-4 sm:px-8 sticky top-0 bg-white z-10"
        style={{ borderBottom: '0.5px solid #e5e7eb' }}
      >
        <div className="flex items-center gap-2">
          <MobileNavDrawer items={buildMobileNavItems(isOwner)} />
          <span
            className="text-base font-semibold select-none"
            style={{ letterSpacing: '-0.01em' }}
          >
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
          </span>
        </div>
        <nav className="hidden sm:flex items-center gap-0.5">
          {isOwner && <NavTab to="/dashboard" label="Dashboard" Icon={LayoutDashboard} />}
          {NAV_ITEMS.map((item) => <NavTab key={item.to} {...item} />)}
          {isOwner && <NavTab to="/settings" label="Settings" Icon={SettingsIcon} />}
        </nav>
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <TrialBanner />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
