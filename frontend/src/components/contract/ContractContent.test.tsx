import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContractContent from './ContractContent'
import { STANDARD_CONTRACT_TERMS } from './terms'

const ORDER = {
  moveDate: 'Jun 15, 2026',
  fromAddress: 'Lake Forest, CA 92630',
  toAddress: 'Anaheim, CA 92801',
  homeSize: '2 BR',
  packing: true,
  totalPrice: 600,
  fromFloor: 1,
  toFloor: 2,
  fromElevator: false,
  toElevator: true,
}

describe('ContractContent', () => {
  it('AC17/AC21 — renders move details and every standard term', () => {
    render(
      <ContractContent
        order={ORDER}
        company={{ name: 'Best Movers', logoUrl: null, phone: null, contractTerms: null }}
      />,
    )
    expect(screen.getByText('Anaheim, CA 92801')).toBeInTheDocument()
    expect(screen.getByText('$600')).toBeInTheDocument()
    for (const term of STANDARD_CONTRACT_TERMS) {
      expect(screen.getByText(term)).toBeInTheDocument()
    }
  })

  it('AC17 — shows custom company terms when present', () => {
    render(
      <ContractContent
        order={ORDER}
        company={{
          name: 'Best Movers',
          logoUrl: null,
          phone: null,
          contractTerms: 'A deposit of 20% is required.',
        }}
      />,
    )
    expect(screen.getByText('A deposit of 20% is required.')).toBeInTheDocument()
    expect(screen.getByText('Best Movers terms')).toBeInTheDocument()
  })

  it('hides the company terms section when contractTerms is empty', () => {
    render(
      <ContractContent
        order={ORDER}
        company={{ name: 'Best Movers', logoUrl: null, phone: null, contractTerms: null }}
      />,
    )
    expect(screen.queryByText('Best Movers terms')).not.toBeInTheDocument()
  })
})
