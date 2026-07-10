import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

const MAX_DESCRIPTION = 300

export default function BookingTab(): JSX.Element {
  const { data: settings } = useSettings()
  const { mutateAsync: save, isPending } = useUpdateSettings()
  const [enabled, setEnabled] = useState(false)
  const [description, setDescription] = useState('')
  const [copied, setCopied] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (settings && !initialized.current) {
      initialized.current = true
      setEnabled(settings.bookingEnabled)
      setDescription(settings.bookingDescription ?? '')
    }
  }, [settings])

  const bookingUrl = settings ? `${window.location.origin}/book/${settings.slug}` : ''

  async function handleSave(): Promise<void> {
    await save({ bookingEnabled: enabled, bookingDescription: description.trim() || null })
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Booking page</h2>
        <div className="flex items-start gap-3">
          <Switch id="bookingEnabled" checked={enabled} onCheckedChange={setEnabled} />
          <div>
            <Label htmlFor="bookingEnabled">Enable booking page</Label>
            <p className="text-xs text-gray-500 mt-0.5">
              When enabled, clients can book moves at your public link.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Your booking link</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-gray-100 rounded px-2 py-1.5 text-gray-700 break-all flex-1 min-w-[200px]">
            {bookingUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={bookingUrl} target="_blank" rel="noreferrer">Open →</a>
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bookingDescription">Company description (shown on booking page)</Label>
        <Textarea
          id="bookingDescription"
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="We are a family-owned moving company serving Orange County since 2010."
        />
        <p className="text-xs text-gray-400">{description.length}/{MAX_DESCRIPTION} characters.</p>
      </div>

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )
}
