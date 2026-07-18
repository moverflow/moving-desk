import type { JSX } from 'react'
import { useState } from 'react'

const CHECKLIST: string[] = [
  'Orders Kanban board — login as owner → go to Orders, see Kanban columns, click card to see details',
  'Lead pipeline — Orders → Leads tab → New lead → move through stages → Convert to order',
  'Self-booking page — open /book/best-pro-3 in private tab, fill form, check Leads tab for new lead with "Online" badge',
  'Digital contract — create order with email bestmover.flow@gmail.com → confirm → check email → sign → verify "Signed" status',
  'Invoice & payment — complete order → generate invoice → Sent → share link → Pay now → test card → auto-updates to Paid',
  'Crew mobile — open /crew/login on phone (Chrome) → login crew@test.com/Crew1234! → Start move → check desktop board updates',
  'AI analytics — Dashboard → AI Insights tab → read insights → ask question in chat',
  'Schedule calendar — click Schedule in nav → see orders on calendar → switch Week/Month',
  'File upload — open any order → Upload → attach PDF or image → verify in files list',
  'Settings — update company name and base rates → create order → verify new price',
]

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 text-sm text-gray-700">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="w-32 shrink-0 text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 break-all">{value}</span>
    </div>
  )
}

export default function TestGuidePage(): JSX.Element {
  const [done, setDone] = useState<boolean[]>(() => CHECKLIST.map(() => false))

  function toggle(i: number): void {
    setDone((prev) => prev.map((d, idx) => (idx === i ? !d : d)))
  }

  const completed = done.filter(Boolean).length

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-[720px] space-y-5">
        <header className="text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">MovingDesk — Test Guide</h1>
          <p className="mt-2 text-sm text-gray-500">Everything you need to try the product end to end.</p>
        </header>

        <Section title="Test accounts">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">Owner</p>
              <Row label="Email" value="bestpro3@gmail.com" />
              <Row label="Password" value="12345678" />
              <Row label="Access" value="Dashboard, all features, billing" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">Crew</p>
              <Row label="Email" value="crew@test.com" />
              <Row label="Password" value="Crew1234!" />
              <Row label="Login at" value="/crew/login" />
            </div>
            <p className="text-xs text-gray-500">Works on all browsers including iOS Safari.</p>
          </div>
        </Section>

        <Section title="Key URLs">
          <div className="space-y-1">
            <Row label="App" value="https://moving-desk.vercel.app" />
            <Row label="Booking page" value="https://moving-desk.vercel.app/book/best-pro-3" />
            <Row label="Crew mobile" value="https://moving-desk.vercel.app/crew/login" />
            <Row label="How it works" value="https://moving-desk.vercel.app/how-it-works" />
          </div>
        </Section>

        <Section title="Stripe test payment card">
          <div className="space-y-1">
            <Row label="Card" value="4242 4242 4242 4242" />
            <Row label="Expiry" value="12/28" />
            <Row label="CVC" value="123" />
            <Row label="ZIP" value="12345" />
            <p className="pt-1 text-xs text-gray-500">No real charges — test mode only</p>
          </div>
        </Section>

        <Section title="Email notifications">
          <div className="space-y-1">
            <Row label="All emails to" value="bestmover.flow@gmail.com" />
            <Row label="Sender" value="onboarding@resend.dev" />
            <Row label="Check spam" value="Yes" />
          </div>
        </Section>

        <Section title={`Test checklist (${completed}/${CHECKLIST.length})`}>
          <ul className="space-y-2">
            {CHECKLIST.map((item, i) => (
              <li key={item}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={done[i]}
                    onChange={() => toggle(i)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className={done[i] ? 'text-gray-400 line-through' : 'text-gray-700'}>
                    <span className="font-medium">{i + 1}.</span> {item}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Known issues">
          <ul className="space-y-1.5">
            <li>Email delivery: Test mode — only to bestmover.flow@gmail.com [Pending domain]</li>
            <li>Stripe: Test mode — no real charges [Safe]</li>
            <li>AI questions: 5 per day per account</li>
          </ul>
        </Section>

        <p className="text-center text-xs text-gray-400">MovingDesk — CRM for moving companies</p>
      </div>
    </div>
  )
}
