import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders a real screenshot image for a placeholder with a configured src', () => {
    renderGuide()
    const img = screen.getByRole('img', { name: 'Screenshot: Settings → Company tab' })
    expect(img).toHaveAttribute('src', '/guide/settings-company.png')
  })

  it('falls back to the labeled placeholder box — not a broken image icon — if the file 404s', () => {
    renderGuide()
    const img = screen.getByRole('img', { name: 'Screenshot: Settings → Company tab' })

    fireEvent.error(img)

    expect(screen.queryByRole('img', { name: 'Screenshot: Settings → Company tab' })).not.toBeInTheDocument()
    expect(screen.getByText('Screenshot: Settings → Company tab')).toBeInTheDocument()
  })

  it('AC — a multi-screenshot section shows every image in step order', () => {
    renderGuide()
    const label = 'Screenshot: Invoice detail, Send to client / Copy link'
    const expectedSrcs = [
      '/guide/invoice-page.png',
      '/guide/invoice-sent-copy-link.png',
      '/guide/invoice-page-payment.png',
      '/guide/invoice-page-payment-successfull.png',
    ]

    expectedSrcs.forEach((src, i) => {
      const img = screen.getByRole('img', { name: `${label} — step ${i + 1} of ${expectedSrcs.length}` })
      expect(img).toHaveAttribute('src', src)
    })
  })

  it('AC — one broken image in a multi-image group falls back without affecting the others', () => {
    renderGuide()
    const label = 'Screenshot: Invoice detail, Send to client / Copy link'
    const firstImg = screen.getByRole('img', { name: `${label} — step 1 of 4` })

    fireEvent.error(firstImg)

    expect(screen.queryByRole('img', { name: `${label} — step 1 of 4` })).not.toBeInTheDocument()
    expect(screen.getByText(`${label} (1/4)`)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `${label} — step 2 of 4` })).toBeInTheDocument()
  })
})
