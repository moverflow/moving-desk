import type { HomeSize } from '@/types'

// Whole US dollars, never cents — the same unit the backend stores and that
// tenant.settings uses.
export interface Pricing {
  baseRates: Record<HomeSize, number>
  packingFee: number
}

// Fallback for before tenant pricing has loaded; the real numbers come from
// GET /settings/pricing via usePricing().
export const DEFAULT_PRICING: Pricing = {
  baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
  packingFee: 120,
}

export function calculatePrice(
  homeSize: HomeSize,
  packing: boolean,
  pricing: Pricing = DEFAULT_PRICING,
): number {
  const base = pricing.baseRates[homeSize] ?? DEFAULT_PRICING.baseRates[homeSize]
  return base + (packing ? pricing.packingFee : 0)
}
