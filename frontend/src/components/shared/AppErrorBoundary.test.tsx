import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { JSX } from 'react'
import AppErrorBoundary from './AppErrorBoundary'

const captureErrorMock = vi.fn()
vi.mock('@/lib/sentry', () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...args),
}))

function Boom(): JSX.Element {
  throw new Error('render exploded')
}

function Fine(): JSX.Element {
  return <p>orders board</p>
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  captureErrorMock.mockReset()
  // React logs caught render errors to console.error; silence it so the
  // expected failures don't look like real test noise.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('AppErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <Fine />
      </AppErrorBoundary>,
    )

    expect(screen.getByText('orders board')).toBeInTheDocument()
  })

  it('shows the fallback instead of a blank screen when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('orders board')).not.toBeInTheDocument()
  })

  it('offers a reload action', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
  })

  it('reports the error to Sentry with the component stack', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )

    expect(captureErrorMock).toHaveBeenCalled()
    const [error, componentStack] = captureErrorMock.mock.calls[0] as [Error, string | undefined]
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('render exploded')
    expect(componentStack).toContain('Boom')
  })
})
