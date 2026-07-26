export interface TourStepDef {
  route: string
  target: string
  title: string
  content: string
}

// Order matters — each step's `before` hook (in ProductTour.tsx) navigates
// here first, so this list doubles as the tour's navigation path.
export const TOUR_STEPS: TourStepDef[] = [
  {
    route: '/dashboard',
    target: '[data-tour="dashboard-welcome"]',
    title: 'Welcome to MovingDesk',
    content: 'This is your dashboard — orders, revenue, and crew performance at a glance. Let\'s set up the essentials.',
  },
  {
    route: '/settings?tab=company',
    target: '[data-tour="base-rates"]',
    title: 'Set your rates',
    content: 'These base rates and the packing fee are what new orders — and your public booking page — price from.',
  },
  {
    route: '/settings?tab=crews',
    target: '[data-tour="add-crew"]',
    title: 'Add your first crew',
    content: 'Crews are the trucks and teams you assign to orders. Add at least one so you can start scheduling moves.',
  },
  {
    route: '/settings?tab=team',
    target: '[data-tour="invite-team"]',
    title: 'Invite your team',
    content: 'Invite a dispatcher or crew member here. If the invite email doesn\'t arrive, you can always copy the join link directly and share it yourself.',
  },
  {
    route: '/settings?tab=booking',
    target: '[data-tour="booking-link"]',
    title: 'Your public booking page',
    content: 'Share this link with clients so they can book moves themselves — it\'s enabled by default, no setup required.',
  },
  {
    route: '/orders',
    target: '[data-tour="orders-kanban"]',
    title: 'Your orders board',
    content: 'Track every move here, from New to Done. Use "+ New order" in the top nav whenever a client books over the phone.',
  },
]

// Joyride's own targetWaitTimeout races the navigation; this polls the DOM
// directly so the tooltip never anchors before the new route has rendered.
export function waitForElement(selector: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    function check(): void {
      if (document.querySelector(selector)) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false)
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })
}
