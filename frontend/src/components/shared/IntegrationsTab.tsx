import type { JSX } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/hooks/useSettings'

const API_URL = import.meta.env.VITE_API_URL as string

export default function IntegrationsTab(): JSX.Element {
  const { data: settings } = useSettings()
  const [copied, setCopied] = useState(false)

  const slug = settings?.slug ?? 'your-company-slug'
  // The webhook secret is a server-side value — owners paste it in from their
  // MovingDesk admin rather than it being exposed to the browser.
  const webhookUrl = `${API_URL}/leads/webhook?secret=YOUR_WEBHOOK_SECRET`

  function copy(): void {
    void navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-4 space-y-5 text-sm">
      <div>
        <h3 className="font-medium text-gray-900">Zapier Integration</h3>
        <p className="mt-1 text-gray-500">
          Connect your website forms, Facebook Lead Ads, or any other source to automatically capture
          leads in MovingDesk.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500">Webhook URL</p>
        <div className="flex gap-2">
          <code className="flex-1 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {webhookUrl}
          </code>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? 'Copied!' : 'Copy URL'}
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Replace <code>YOUR_WEBHOOK_SECRET</code> with the webhook secret from your MovingDesk admin.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500">Your company slug</p>
        <code className="inline-block rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800">
          {slug}
        </code>
        <p className="text-xs text-gray-400">
          Include this in every request: <code>{`"tenant_slug": "${slug}"`}</code>
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500">Supported fields</p>
        <p className="text-xs text-gray-500">name, phone, email, from_address, to_address, move_date, notes</p>
      </div>
    </div>
  )
}
