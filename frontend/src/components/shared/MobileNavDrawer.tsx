import type { JSX } from 'react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export interface MobileNavItem {
  to: string
  label: string
  Icon: LucideIcon
}

interface MobileNavDrawerProps {
  items: MobileNavItem[]
}

function DrawerNavLinks({ items, onNavigate }: { items: MobileNavItem[]; onNavigate: () => void }): JSX.Element {
  return (
    <nav className="flex flex-col p-2">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }: { isActive: boolean }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50',
            )
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

// AppShell's desktop nav goes icon-only below `sm`, but even icon-only, 7 tabs
// (5 base + Dashboard + Settings for owner) plus the wordmark, bell and user menu
// don't fit an iPhone-width header. A drawer (reusing this codebase's existing
// Sheet component, already used for OrderDetailSheet/ClientDetailSheet) shows
// every item with its full label instead of picking which ones to drop.
export default function MobileNavDrawer({ items }: MobileNavDrawerProps): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors sm:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={19} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="px-4 py-4 border-b">
          <SheetTitle className="text-base font-semibold text-left">
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
          </SheetTitle>
        </SheetHeader>
        <DrawerNavLinks items={items} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
