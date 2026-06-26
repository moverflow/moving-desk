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
      style={{
        maxWidth: maxWidth !== undefined ? maxWidth : undefined,
        margin: '0 auto',
        paddingLeft: 32,
        paddingRight: 32,
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}
