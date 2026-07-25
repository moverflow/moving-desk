import type { JSX } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicInvoice } from '@/hooks/useInvoices'

function StatusCard({ icon, title, message }: { icon: string; title: string; message: string }): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg border w-full max-w-md p-8 text-center space-y-4">
        <div className="text-5xl">{icon}</div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

type PayOutcome = 'error' | 'paid' | 'unclear' | 'processing'

const OUTCOME_CONTENT: Record<PayOutcome, { icon: string; title: string; message: string }> = {
  error: {
    icon: '⚠️',
    title: 'Something went wrong',
    message: "We couldn't confirm this payment. If you were charged, please contact the moving company directly.",
  },
  paid: {
    icon: '✅',
    title: 'Payment successful!',
    message: 'Thank you for your payment. A confirmation has been sent to your email.',
  },
  unclear: {
    icon: '⚠️',
    title: 'Payment status changed',
    message: 'Please contact the moving company to confirm your payment status.',
  },
  processing: {
    icon: '⏳',
    title: 'Processing your payment…',
    message: 'This can take a few seconds — this page updates automatically, no need to refresh.',
  },
}

function resolveOutcome(hasToken: boolean, isError: boolean, status: string | undefined): PayOutcome {
  if (!hasToken || isError) return 'error'
  if (status === 'paid') return 'paid'
  if (status === 'refunded' || status === 'disputed') return 'unclear'
  return 'processing'
}

// Reached right after a Stripe redirect, before the webhook that actually marks the
// invoice paid has necessarily landed — so this polls the real invoice status
// instead of unconditionally claiming success (the previous version showed
// "Payment successful!" no matter what actually happened).
export default function PaySuccessPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const { data, isError } = usePublicInvoice(token, { pollUntilResolved: true })
  const outcome = resolveOutcome(token.length > 0, isError, data?.invoice.status)

  return <StatusCard {...OUTCOME_CONTENT[outcome]} />
}
