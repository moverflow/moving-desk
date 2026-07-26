import type { JSX } from 'react'
import { ImageOff } from 'lucide-react'

interface GuidePlaceholderProps {
  label: string
}

export default function GuidePlaceholder({ label }: GuidePlaceholderProps): JSX.Element {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
      <ImageOff className="h-5 w-5 text-gray-400" aria-hidden />
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  )
}
