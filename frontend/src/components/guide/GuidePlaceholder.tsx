import type { JSX } from 'react'
import { useState } from 'react'
import { ImageOff } from 'lucide-react'

function FallbackBox({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
      <ImageOff className="h-5 w-5 text-gray-400" aria-hidden />
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  )
}

interface GuideImageProps {
  src: string
  alt: string
  fallbackLabel: string
  className: string
}

// Each image tracks its own load failure — one broken file in a multi-image
// group should not take the rest of the gallery down with it.
function GuideImage({ src, alt, fallbackLabel, className }: GuideImageProps): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed) return <FallbackBox label={fallbackLabel} />
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

interface GuidePlaceholderProps {
  label: string
  images?: string[]
}

export default function GuidePlaceholder({ label, images }: GuidePlaceholderProps): JSX.Element {
  if (!images || images.length === 0) {
    return <FallbackBox label={label} />
  }

  if (images.length === 1) {
    return (
      <GuideImage
        src={images[0]}
        alt={label}
        fallbackLabel={label}
        className="w-full rounded-lg border border-gray-200"
      />
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {images.map((src, i) => (
        <div key={src} className="relative w-56 shrink-0">
          <GuideImage
            src={src}
            alt={`${label} — step ${i + 1} of ${images.length}`}
            fallbackLabel={`${label} (${i + 1}/${images.length})`}
            className="w-full rounded-lg border border-gray-200"
          />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  )
}
