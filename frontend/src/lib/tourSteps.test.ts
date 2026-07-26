import { describe, it, expect } from 'vitest'
import { TOUR_STEPS, waitForElement } from './tourSteps'

describe('TOUR_STEPS', () => {
  it('covers the core setup-critical pages in order: dashboard, company, crews, team, booking, orders', () => {
    expect(TOUR_STEPS.map((s) => s.route)).toEqual([
      '/dashboard',
      '/settings?tab=company',
      '/settings?tab=crews',
      '/settings?tab=team',
      '/settings?tab=booking',
      '/orders',
    ])
  })

  it('gives every step a non-empty target, title, and content', () => {
    for (const step of TOUR_STEPS) {
      expect(step.target.length).toBeGreaterThan(0)
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.content.length).toBeGreaterThan(0)
    }
  })
})

describe('waitForElement', () => {
  it('resolves true immediately when the element already exists', async () => {
    const el = document.createElement('div')
    el.setAttribute('data-tour', 'already-there')
    document.body.appendChild(el)

    await expect(waitForElement('[data-tour="already-there"]')).resolves.toBe(true)
    document.body.removeChild(el)
  })

  it('resolves true once the element appears asynchronously', async () => {
    const promise = waitForElement('[data-tour="appears-later"]', 2000)
    setTimeout(() => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'appears-later')
      document.body.appendChild(el)
    }, 20)

    await expect(promise).resolves.toBe(true)
    document.body.querySelector('[data-tour="appears-later"]')?.remove()
  })

  it('resolves false when the element never appears within the timeout', async () => {
    await expect(waitForElement('[data-tour="never"]', 50)).resolves.toBe(false)
  })
})
