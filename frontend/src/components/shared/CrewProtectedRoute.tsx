import type { JSX } from 'react'
import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth.store'

export default function CrewProtectedRoute(): JSX.Element {
  const { isAuthenticated, user, setAuth } = useAuthStore()
  const { data, isLoading } = useMe()

  useEffect(() => {
    if (data && !isAuthenticated) {
      setAuth(data.user, data.tenant)
    }
  }, [data, isAuthenticated, setAuth])

  if (isAuthenticated) {
    // Only crew members get the crew screen; everyone else goes to the main app.
    return user?.role === 'crew' ? <Outlet /> : <Navigate to="/orders" replace />
  }

  if (isLoading || data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  return <Navigate to="/crew/login" replace />
}
