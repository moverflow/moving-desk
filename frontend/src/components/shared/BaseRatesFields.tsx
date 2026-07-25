import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RATE_ROWS: { key: string; label: string }[] = [
  { key: 'studio', label: 'Studio' },
  { key: '1br', label: '1 BR' },
  { key: '2br', label: '2 BR' },
  { key: '3br', label: '3 BR' },
  { key: 'house', label: 'House' },
]

interface BaseRatesFieldsProps {
  rates: Record<string, number>
  onChange: (key: string, value: number) => void
  packingFee: number
  onPackingFeeChange: (value: number) => void
  disabled: boolean
}

export default function BaseRatesFields({
  rates,
  onChange,
  packingFee,
  onPackingFeeChange,
  disabled,
}: BaseRatesFieldsProps): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>Base rates</Label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {RATE_ROWS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-gray-500">{label}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <Input
                type="number"
                min={0}
                value={rates[key] ?? 0}
                onChange={(e) => onChange(key, parseInt(e.target.value, 10) || 0)}
                disabled={disabled}
                className="pl-6"
              />
            </div>
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="packingFee" className="text-xs text-gray-500">Packing service</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <Input
              id="packingFee"
              type="number"
              min={0}
              value={packingFee}
              onChange={(e) => onPackingFeeChange(parseInt(e.target.value, 10) || 0)}
              disabled={disabled}
              className="pl-6"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
