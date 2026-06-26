import type { JSX, ChangeEvent } from 'react'
import { useState } from 'react'
import { Label } from '@/components/ui/label'

interface LogoFieldProps {
  initialPreview: string | null
  onPreviewChange: (url: string | null) => void
  onFileSelect?: (file: File | null) => void
  disabled: boolean
}

export default function LogoField({ initialPreview, onPreviewChange, onFileSelect, disabled }: LogoFieldProps): JSX.Element {
  const [preview, setPreview] = useState<string | null>(initialPreview)

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect?.(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPreview(reader.result)
        onPreviewChange(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleRemove(): void {
    setPreview(null)
    onPreviewChange(null)
    onFileSelect?.(null)
  }

  return (
    <div className="space-y-1.5">
      <Label>Company logo</Label>
      {preview !== null ? (
        <div className="flex items-center gap-3">
          <img src={preview} alt="Logo preview" className="h-14 w-14 rounded-md object-cover border" />
          <button type="button" onClick={handleRemove} disabled={disabled} className="text-sm text-gray-500 hover:text-gray-700">Remove</button>
        </div>
      ) : (
        <input type="file" accept="image/*" onChange={handleChange} disabled={disabled} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700" />
      )}
    </div>
  )
}
