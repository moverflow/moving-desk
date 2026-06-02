import type { JSX, ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface AuthCardProps {
  subtitle: string
  children: ReactNode
}

export default function AuthCard({ subtitle, children }: AuthCardProps): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="items-center pb-2">
          <span className="text-xl font-semibold select-none">
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
          </span>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
