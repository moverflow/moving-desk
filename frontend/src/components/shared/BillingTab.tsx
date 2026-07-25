import type { JSX } from 'react'
import { formatTimestamp } from '@/lib/utils'
import { useSubscription } from '@/hooks/useSettings'

const PLAN_STYLES: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-700',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-green-100 text-green-700',
}

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial', basic: 'Basic — $49/mo', pro: 'Pro — $99/mo',
}

export default function BillingTab(): JSX.Element {
  const { data: sub } = useSubscription()

  const daysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Current plan</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_STYLES[sub?.plan ?? 'trial'] ?? ''}`}>
            {PLAN_LABEL[sub?.plan ?? 'trial']}
          </span>
        </div>
        {sub?.plan === 'trial' && daysLeft !== null && (
          <p className="text-sm text-gray-600">
            Trial ends {sub.trialEndsAt ? formatTimestamp(new Date(sub.trialEndsAt)) : '—'} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </p>
        )}
      </div>
      <div className="space-y-2">
        <button type="button" className="w-full rounded-md border px-4 py-2.5 text-sm font-medium text-white text-center hover:opacity-90" style={{ backgroundColor: '#1d9e75' }}
          onClick={() => { window.alert('Stripe checkout — not connected in mock mode') }}>
          Upgrade to Pro
        </button>
        {sub?.plan !== 'trial' && (
          <button type="button" className="w-full rounded-md border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => { window.alert('Stripe billing portal — not connected in mock mode') }}>
            Manage billing
          </button>
        )}
      </div>
    </div>
  )
}
