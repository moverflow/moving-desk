import type { JSX } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { AIInsight } from '@/types'

export default function InsightCard({ insight }: { insight: AIInsight }): JSX.Element {
  return (
    <Card>
      <CardContent className="flex gap-3 p-5">
        <span className="text-2xl leading-none">{insight.emoji}</span>
        <div>
          <div className="font-semibold text-gray-900 mb-1">{insight.title}</div>
          <div className="text-sm text-gray-600 leading-relaxed">{insight.text}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function InsightCardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex gap-3 p-5">
        <div className="h-6 w-6 shrink-0 rounded bg-gray-100 animate-pulse" />
        <div className="w-full">
          <div className="h-4 w-32 rounded bg-gray-100 animate-pulse mb-2" />
          <div className="h-3 w-full rounded bg-gray-100 animate-pulse mb-1.5" />
          <div className="h-3 w-4/5 rounded bg-gray-100 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
