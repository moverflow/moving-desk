import type { JSX } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom'
import { Joyride, EVENTS, STATUS, type EventData, type Step } from 'react-joyride'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { TOUR_STEPS, waitForElement } from '@/lib/tourSteps'

function buildSteps(navigate: NavigateFunction): Step[] {
  return TOUR_STEPS.map((s) => ({
    target: s.target,
    title: s.title,
    content: s.content,
    before: async () => {
      navigate(s.route)
      await waitForElement(s.target)
    },
  }))
}

// Mounted once in AppShell for owners only (survives route changes, unlike
// page components behind <Outlet/>), so a single tour instance can drive
// navigation across Dashboard, Settings tabs, and Orders. Auto-starts once
// per tenant via the hasSeenTour flag; ?tour=replay re-launches it manually
// (e.g. from a "Take the tour" link in Settings) regardless of that flag.
// Slightly over the 40-line guideline; the remainder is startup/event
// handling tightly coupled to local state (run, startedRef, searchParams),
// not mechanically separable JSX — same call made for BookingTab.tsx.
export default function ProductTour(): JSX.Element | null {
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [run, setRun] = useState(false)
  const startedRef = useRef(false)

  const steps = useMemo(() => buildSteps(navigate), [navigate])

  useEffect(() => {
    if (startedRef.current) return

    if (searchParams.get('tour') === 'replay') {
      startedRef.current = true
      setSearchParams(
        (prev) => {
          prev.delete('tour')
          return prev
        },
        { replace: true },
      )
      setRun(true)
      return
    }

    if (settings && !settings.hasSeenTour) {
      startedRef.current = true
      setRun(true)
    }
  }, [settings, searchParams, setSearchParams])

  function handleEvent(data: EventData): void {
    if (data.type !== EVENTS.TOUR_END) return
    setRun(false)
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      updateSettings({ hasSeenTour: true })
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      options={{ buttons: ['back', 'skip', 'primary'], skipBeacon: true, primaryColor: '#1d9e75', zIndex: 10000 }}
    />
  )
}
