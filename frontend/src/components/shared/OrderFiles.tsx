import type { JSX, ChangeEvent } from 'react'
import { useRef, useState } from 'react'
import type { OrderFile } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatFileSize } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { useDeleteOrderFile, useOrderFiles, useUploadOrderFile } from '@/hooks/useOrderFiles'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface FileRowProps {
  file: OrderFile
  onDelete: (fileId: string) => void
  isDeleting: boolean
}

function FileRow({ file, onDelete, isDeleting }: FileRowProps): JSX.Element {
  const isImage = IMAGE_MIME_TYPES.has(file.mimeType)

  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-0">
      {isImage ? (
        <img src={file.url} alt={file.name} className="h-10 w-10 rounded object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center text-xl" aria-hidden>
          📄
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
      </div>
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Download
      </a>
      <button
        type="button"
        onClick={() => onDelete(file.id)}
        disabled={isDeleting}
        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

interface UploadControlProps {
  onSelect: (file: File) => void
  isPending: boolean
}

function UploadControl({ onSelect, isPending }: UploadControlProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onSelect(file)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? 'Uploading...' : '+ Upload'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}

interface OrderFilesProps {
  orderId: string
}

export default function OrderFiles({ orderId }: OrderFilesProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const { data: files = [] } = useOrderFiles(orderId)
  const upload = useUploadOrderFile(orderId)
  const deleteFile = useDeleteOrderFile(orderId)

  function handleUpload(file: File): void {
    setError(null)
    upload.mutate(file, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload failed'),
    })
  }

  function handleDelete(fileId: string): void {
    if (!window.confirm('Delete this file?')) return
    setError(null)
    deleteFile.mutate(fileId, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Delete failed'),
    })
  }

  return (
    <div className="mt-6 space-y-2">
      <div className="flex items-center justify-between">
        <Label>Files ({files.length})</Label>
        <UploadControl onSelect={handleUpload} isPending={upload.isPending} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            onDelete={handleDelete}
            isDeleting={deleteFile.isPending}
          />
        ))}
      </div>
    </div>
  )
}
