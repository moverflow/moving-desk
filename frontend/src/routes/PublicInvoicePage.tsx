import type { JSX } from 'react'
import { useParams } from 'react-router-dom'
import { usePublicInvoice } from '@/hooks/useInvoices'
import PublicInvoiceContent from '@/components/shared/PublicInvoiceContent'

export default function PublicInvoicePage(): JSX.Element {
  const { token = '' } = useParams<{ token: string }>()
  const { data, isLoading, isError } = usePublicInvoice(token)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">This invoice link is invalid or has expired.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6">
      <PublicInvoiceContent invoice={data.invoice} company={data.company} />
    </div>
  )
}
