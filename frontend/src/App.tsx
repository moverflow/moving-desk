import type { JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/shared/AppShell'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import OrdersPage from '@/routes/OrdersPage'
import NewOrderPage from '@/routes/NewOrderPage'
import InvoicesPage from '@/routes/InvoicesPage'
import ClientsPage from '@/routes/ClientsPage'
import RegisterPage from '@/routes/RegisterPage'
import LoginPage from '@/routes/LoginPage'
import QuickSetupPage from '@/routes/QuickSetupPage'
import JoinPage from '@/routes/JoinPage'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<QuickSetupPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/new-order" element={<NewOrderPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/clients" element={<ClientsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
