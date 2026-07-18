import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HowItWorksPage from './HowItWorksPage'

describe('HowItWorksPage', () => {
  it('AC1 — renders the six pipeline steps as buttons', () => {
    render(<HowItWorksPage />)
    for (const title of [
      'Lead captured',
      'Order created',
      'Contract signed',
      'Move day',
      'Invoice sent',
      'Payment received',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(title, 'i') })).toBeInTheDocument()
    }
  })

  it('AC3 — shows the three role columns', () => {
    render(<HowItWorksPage />)
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Dispatcher')).toBeInTheDocument()
    expect(screen.getByText('Crew')).toBeInTheDocument()
  })

  it('AC2 — clicking a step swaps the detail panel to that step’s actions', async () => {
    const user = userEvent.setup()
    render(<HowItWorksPage />)

    // Step 1 is selected by default.
    expect(screen.getByText('Monitor lead pipeline')).toBeInTheDocument()
    expect(screen.queryByText('Fill order form in 90 seconds')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Order created/i }))

    expect(screen.getByText('Fill order form in 90 seconds')).toBeInTheDocument()
    expect(screen.queryByText('Monitor lead pipeline')).not.toBeInTheDocument()
  })
})
