import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { getPersonInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

export default function UserMenu(): JSX.Element | null {
  const { user, tenant } = useAuthStore()
  const { data: settings } = useSettings()
  const navigate = useNavigate()
  const { mutate: logout, isPending } = useLogout()
  const [open, setOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!showLogoutConfirm) return

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setShowLogoutConfirm(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showLogoutConfirm])

  if (!user) return null

  const companyName = settings?.companyName ?? tenant?.name ?? ''
  const logoUrl = settings?.logoUrl ?? null

  function handleLogout(): void {
    logout(undefined, {
      onSuccess: () => {
        setOpen(false)
        setShowLogoutConfirm(false)
        navigate('/login', { replace: true })
      },
    })
  }

  return (
    <>
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold shrink-0 hover:opacity-90 transition-opacity cursor-pointer overflow-hidden"
        style={{ backgroundColor: logoUrl ? undefined : '#1d9e75', fontSize: 12 }}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName || 'Company logo'}
            className="h-full w-full object-cover"
          />
        ) : (
          getPersonInitials(companyName || user.name)
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-md border bg-white shadow-lg py-1 z-50"
        >
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setShowLogoutConfirm(true)
            }}
            disabled={isPending}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <LogOut size={14} />
            {isPending ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      )}
    </div>
    {showLogoutConfirm && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4"
        onClick={() => setShowLogoutConfirm(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className="w-full max-w-xs rounded-lg border bg-white p-5 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <p id="logout-confirm-title" className="text-sm font-medium text-gray-900">
            Log out?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You will need to sign in again to continue.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutConfirm(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              disabled={isPending}
            >
              {isPending ? 'Logging out...' : 'Log out'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
