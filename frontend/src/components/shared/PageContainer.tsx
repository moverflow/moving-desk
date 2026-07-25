import type { JSX, ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  variant?: 'default' | 'narrow' | 'wide'
}

const MAX_WIDTH: Record<'default' | 'narrow' | 'wide', number | undefined> = {
  narrow:  680,
  default: 1040,
  wide:    undefined,
}

export default function PageContainer({ children, variant = 'default' }: PageContainerProps): JSX.Element {
  const maxWidth = MAX_WIDTH[variant]
  return (
    <div
      className="mx-auto w-full px-4 sm:px-8"
      style={{ maxWidth: maxWidth !== undefined ? maxWidth : undefined }}
    >
      {children}
    </div>
  )
}
