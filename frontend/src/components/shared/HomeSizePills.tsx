import type { JSX } from 'react'
import type { HomeSize } from '@/types'
import { cn } from '@/lib/utils'

const SIZES: { value: HomeSize; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: '1br', label: '1 BR' },
  { value: '2br', label: '2 BR' },
  { value: '3br', label: '3 BR' },
  { value: 'house', label: 'House' },
]

interface HomeSizePillsProps {
  value: HomeSize
  onChange: (size: HomeSize) => void
}

export default function HomeSizePills({ value, onChange }: HomeSizePillsProps): JSX.Element {
  return (
    <div className="flex gap-2 flex-wrap">
      {SIZES.map(({ value: size, label }) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm border transition-colors',
            value === size
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
