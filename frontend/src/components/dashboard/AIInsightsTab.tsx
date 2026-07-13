import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { useAIInsights } from '@/hooks/useAIInsights'
import AIChat from './AIChat'
import InsightCard, { InsightCardSkeleton } from './InsightCard'

const MIN_ORDERS = 10

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-3xl">🔍</div>
      <p className="font-semibold text-gray-900">Not enough data yet</p>
      <p className="max-w-sm text-sm text-gray-500">
        Add at least 10 completed orders to unlock AI insights. AI needs real data to find
        meaningful patterns in your business.
      </p>
      <Link to="/orders" className="text-sm font-medium text-[#1d9e75] hover:underline">
        Go to Orders →
      </Link>
    </div>
  )
}

export default function AIInsightsTab(): JSX.Element {
  const { data, isLoading, isError } = useAIInsights()

  let inner: JSX.Element
  if (isLoading) {
    inner = (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <InsightCardSkeleton key={i} />
        ))}
      </div>
    )
  } else if (isError || !data) {
    inner = (
      <p className="py-8 text-center text-sm text-gray-500">
        Couldn&apos;t load AI insights. Please try again later.
      </p>
    )
  } else if (data.metrics.totalOrders < MIN_ORDERS) {
    inner = <EmptyState />
  } else {
    inner = (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-900">Auto insights</p>
          {data.insights.map((insight, i) => (
            <InsightCard key={`${insight.type}-${i}`} insight={insight} />
          ))}
        </div>
        <div className="border-t border-gray-200" />
        <AIChat />
      </div>
    )
  }

  return <div className="mx-auto w-full max-w-3xl">{inner}</div>
}
