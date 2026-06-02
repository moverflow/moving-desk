import type { JSX, ChangeEvent } from 'react'
import { useState } from 'react'
import { Label } from '@/components/ui/label'

interface LogoUploadProps {
  onSkip: () => void
}

export default function LogoUpload({ onSkip }: LogoUploadProps): JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <Label>Company logo</Label>
      {preview !== null ? (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="Logo preview"
            className="h-16 w-16 rounded-md object-cover border"
          />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Remove
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
        />
      )}
      <button
        type="button"
        onClick={onSkip}
        className="block text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
      >
        Skip for now
      </button>
    </div>
  )
}
