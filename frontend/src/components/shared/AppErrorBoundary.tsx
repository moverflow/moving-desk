import { Component, type ErrorInfo, type JSX, type ReactNode } from 'react'
import { captureError } from '@/lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export function ErrorFallback(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <p className="text-4xl mb-3">😕</p>
      <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        The page ran into an unexpected problem. Reloading usually fixes it — our team has been
        notified.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Reload page
      </button>
    </div>
  )
}

// One boundary at the root of the app. Without it an uncaught render error
// unmounts the whole tree and leaves a blank white page that is never reported.
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, info.componentStack ?? undefined)
  }

  render(): ReactNode {
    return this.state.hasError ? <ErrorFallback /> : this.props.children
  }
}
