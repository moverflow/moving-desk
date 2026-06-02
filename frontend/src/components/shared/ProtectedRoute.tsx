import type { JSX } from 'react'
import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from '@/hooks/useAuth'
import { MOCK_TENANT, useAuthStore } from '@/store/auth.store'

export default function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, setAuth } = useAuthStore()
  const { data: user, isLoading } = useMe()

  useEffect(() => {
    if (user && !isAuthenticated) {
      setAuth(user, MOCK_TENANT)
    }
  }, [user, isAuthenticated, setAuth])

  if (isAuthenticated) return <Outlet />

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return <Navigate to="/login" replace />
}
