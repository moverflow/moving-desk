import type { HomeSize } from '@/types'

const BASE_RATES: Record<HomeSize, number> = {
  studio: 280,
  '1br': 380,
  '2br': 480,
  '3br': 620,
  house: 850,
}

export function calculatePrice(homeSize: HomeSize, packing: boolean): number {
  return (BASE_RATES[homeSize] ?? 480) + (packing ? 120 : 0)
}
