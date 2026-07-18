import type { JSX } from 'react'
import { useState } from 'react'

interface Step {
  n: number
  title: string
  color: string
  owner: string[]
  dispatcher: string[]
  crew: string[]
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Lead captured',
    color: '#378ADD',
    owner: ['Monitor lead pipeline', 'Set up booking page in Settings', 'Configure Zapier webhook URL'],
    dispatcher: [
      'Manually add lead from phone call',
      'Review online booking requests',
      'Move lead New → Contacted → Quoted',
      'Convert lead to order when ready',
    ],
    crew: ['Not involved at this stage'],
  },
  {
    n: 2,
    title: 'Order created',
    color: '#EF9F27',
    owner: ['See all orders on dashboard', 'Review revenue per order'],
    dispatcher: [
      'Fill order form in 90 seconds',
      'Phone lookup auto-fills client data',
      'Select home size → price calculated',
      'Assign crew to the order',
      'Order appears on Kanban board',
    ],
    crew: ['Not involved yet'],
  },
  {
    n: 3,
    title: 'Contract signed',
    color: '#1D9E75',
    owner: ['Set custom contract terms in Settings', 'Get notified when client signs'],
    dispatcher: [
      'Contract auto-sent when order confirmed',
      'See contract status on order card',
      'Resend contract if needed',
      'View signed PDF in order files',
    ],
    crew: ['Receive job details after contract signed', 'See order in their mobile app'],
  },
  {
    n: 4,
    title: 'Move day',
    color: '#534AB7',
    owner: ['See real-time status on dashboard', 'Monitor crew utilization'],
    dispatcher: [
      'Track status changes on Kanban board',
      'See urgency colors (Today = red)',
      'Contact crew via phone if needed',
      'Update notes if situation changes',
    ],
    crew: [
      "Open PWA on phone — see today's job",
      'Tap "Start move" when arriving',
      'See client phone call directly',
      'Read dispatcher notes and files',
      'Tap "Complete" when done',
    ],
  },
  {
    n: 5,
    title: 'Invoice sent',
    color: '#D85A30',
    owner: ['See invoice revenue in dashboard', 'Track paid vs unpaid invoices'],
    dispatcher: [
      'Generate invoice from completed order',
      'Send PDF to client via email',
      'Share payment link with client',
      'Track Draft → Sent → Paid status',
    ],
    crew: ['Not involved at this stage'],
  },
  {
    n: 6,
    title: 'Payment received',
    color: '#639922',
    owner: ['Revenue appears in dashboard', 'See monthly totals and trends', 'Ask AI "Why did revenue grow?"'],
    dispatcher: ['Invoice status auto-updates to Paid', 'Client receives payment confirmation', 'Order marked as closed'],
    crew: ['Not involved at this stage'],
  },
]

const ROLES = [
  { key: 'owner', label: 'Owner', color: '#1D9E75' },
  { key: 'dispatcher', label: 'Dispatcher', color: '#378ADD' },
  { key: 'crew', label: 'Crew', color: '#534AB7' },
] as const

function RoleColumn({ label, color, actions }: { label: string; color: string; actions: string[] }): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <ul className="p-4 space-y-2">
        {actions.map((a) => (
          <li key={a} className="flex gap-2 text-sm text-gray-700">
            <span aria-hidden style={{ color }}>
              •
            </span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function HowItWorksPage(): JSX.Element {
  const [selected, setSelected] = useState(0)
  const step = STEPS[selected]

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-[960px]">
        <header className="text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">How MovingDesk works</h1>
          <p className="mt-2 text-sm text-gray-500">
            From first call to payment received — click any step to see details
          </p>
        </header>

        <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const active = i === selected
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={active}
                className="min-w-[140px] flex-1 rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: active ? s.color : '#e5e7eb',
                  backgroundColor: active ? s.color : '#ffffff',
                }}
              >
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.25)' : s.color,
                    color: active ? '#ffffff' : '#ffffff',
                  }}
                >
                  {s.n}
                </span>
                <span
                  className="mt-2 block text-sm font-medium"
                  style={{ color: active ? '#ffffff' : '#1a1a18' }}
                >
                  {s.title}
                </span>
              </button>
            )
          })}
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Step {step.n}: {step.title}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLES.map((r) => (
              <RoleColumn key={r.key} label={r.label} color={r.color} actions={step[r.key]} />
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-gray-400">MovingDesk — CRM for moving companies</p>
      </div>
    </div>
  )
}
