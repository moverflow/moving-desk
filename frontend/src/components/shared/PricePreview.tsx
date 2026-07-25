import type { JSX } from 'react'
import type { HomeSize } from '@/types'
import { calculatePrice } from '@/lib/pricing'
import { usePricing } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/utils'

interface PricePreviewProps {
  homeSize: HomeSize
  packing: boolean
}

export default function PricePreview({ homeSize, packing }: PricePreviewProps): JSX.Element {
  const { data: pricing } = usePricing()
  const price = calculatePrice(homeSize, packing, pricing)
  return (
    <div className="rounded-md bg-gray-50 border px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-gray-600">Estimated price</span>
      <span className="text-lg font-semibold" style={{ color: '#1d9e75' }}>
        {formatCurrency(price)}
      </span>
    </div>
  )
}
