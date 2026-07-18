import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TestGuidePage from './TestGuidePage'

describe('TestGuidePage', () => {
  it('AC4 — renders all guide sections', () => {
    render(<TestGuidePage />)
    expect(screen.getByText('Test accounts')).toBeInTheDocument()
    expect(screen.getByText('Key URLs')).toBeInTheDocument()
    expect(screen.getByText('Stripe test payment card')).toBeInTheDocument()
    expect(screen.getByText('Email notifications')).toBeInTheDocument()
    expect(screen.getByText('Known issues')).toBeInTheDocument()
    expect(screen.getByText(/Test checklist/)).toBeInTheDocument()
  })

  it('AC5 — checklist items toggle done state', async () => {
    const user = userEvent.setup()
    render(<TestGuidePage />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(10)
    expect(boxes[0]).not.toBeChecked()
    expect(screen.getByText('Test checklist (0/10)')).toBeInTheDocument()

    await user.click(boxes[0])

    expect(boxes[0]).toBeChecked()
    expect(screen.getByText('Test checklist (1/10)')).toBeInTheDocument()

    await user.click(boxes[0])
    expect(boxes[0]).not.toBeChecked()
    expect(screen.getByText('Test checklist (0/10)')).toBeInTheDocument()
  })
})
