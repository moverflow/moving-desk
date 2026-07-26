import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GuidePage from './GuidePage'
import { GUIDE_CONTENT } from '@/lib/guide-content'

function renderGuide() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <GuidePage />
    </QueryClientProvider>,
  )
}

describe('GuidePage', () => {
  it('renders all 10 sections in English by default', () => {
    renderGuide()
    expect(GUIDE_CONTENT.en).toHaveLength(10)
    for (const section of GUIDE_CONTENT.en) {
      expect(screen.getAllByText(section.title).length).toBeGreaterThan(0)
    }
  })

  it('switches all content to Russian instantly on toggle, no reload', async () => {
    const user = userEvent.setup()
    renderGuide()

    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0)
    expect(screen.queryByText('Обзор')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'RU' }))

    expect(screen.getAllByText('Обзор').length).toBeGreaterThan(0)
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0)
  })

  it('renders section anchors matching the table of contents links', () => {
    renderGuide()
    GUIDE_CONTENT.en.forEach((section, i) => {
      expect(document.getElementById(section.id)).not.toBeNull()
      const link = screen.getByRole('link', { name: `${i + 1}. ${section.title}` })
      expect(link).toHaveAttribute('href', `#${section.id}`)
    })
  })

  it('renders labeled screenshot placeholders instead of broken images', () => {
    renderGuide()
    expect(screen.getByText('Screenshot: Settings → Company tab')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
