import type { JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/shared/AppShell'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import DashboardPage from '@/routes/DashboardPage'
import OrdersPage from '@/routes/OrdersPage'
import SchedulePage from '@/routes/SchedulePage'
import NewOrderPage from '@/routes/NewOrderPage'
import InvoicesPage from '@/routes/InvoicesPage'
import ClientsPage from '@/routes/ClientsPage'
import RegisterPage from '@/routes/RegisterPage'
import LoginPage from '@/routes/LoginPage'
import QuickSetupPage from '@/routes/QuickSetupPage'
import JoinPage from '@/routes/JoinPage'
import PublicInvoicePage from '@/routes/PublicInvoicePage'
import BookingPage from '@/routes/BookingPage'
import ContractPage from '@/routes/ContractPage'
import SettingsPage from '@/routes/SettingsPage'
import { useAuthStore } from '@/store/auth.store'

function DefaultRedirect(): JSX.Element {
  const role = useAuthStore((s) => s.user?.role)
  return <Navigate to={role === 'owner' ? '/dashboard' : '/orders'} replace />
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<QuickSetupPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/i/:token" element={<PublicInvoicePage />} />
      <Route path="/book/:slug" element={<BookingPage />} />
      <Route path="/contract/:token" element={<ContractPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/new-order" element={<NewOrderPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
