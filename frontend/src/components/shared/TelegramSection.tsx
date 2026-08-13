import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  useCreateTelegramLinkCode,
  useDisconnectTelegram,
  useTelegramStatus,
} from '@/hooks/useTelegram'
import type { TelegramLinkCode } from '@/types'

function ConnectedState({ onDisconnect, pending }: {
  onDisconnect: () => void
  pending: boolean
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Connected
      </span>
      <p className="text-xs text-gray-500">
        New leads, signed contracts and paid invoices are sent to your Telegram.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onDisconnect} disabled={pending}>
        Disconnect
      </Button>
    </div>
  )
}

function LinkCodePanel({ link }: { link: TelegramLinkCode }): JSX.Element {
  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">Your connect code</p>
      <code className="block text-lg font-semibold tracking-[0.2em] text-gray-900">
        {link.code}
      </code>
      <Button type="button" size="sm" asChild>
        <a href={link.deepLink} target="_blank" rel="noreferrer">Open Telegram →</a>
      </Button>
      <p className="text-xs text-gray-500">
        Or open the bot yourself and send <code>/start {link.code}</code>. The code expires in
        15 minutes and works once.
      </p>
    </div>
  )
}

interface DisconnectedStateProps {
  link: TelegramLinkCode | null
  onGenerate: () => void
  pending: boolean
  failed: boolean
}

function DisconnectedState({ link, onGenerate, pending, failed }: DisconnectedStateProps): JSX.Element {
  return (
    <div className="space-y-3">
      {link
        ? <LinkCodePanel link={link} />
        : (
          <Button type="button" size="sm" onClick={onGenerate} disabled={pending}>
            {pending ? 'Generating…' : 'Connect Telegram'}
          </Button>
        )}
      {failed && (
        <p className="text-xs text-red-600">Could not generate a code. Please try again.</p>
      )}
    </div>
  )
}

export default function TelegramSection(): JSX.Element | null {
  const [link, setLink] = useState<TelegramLinkCode | null>(null)
  const { data: status } = useTelegramStatus(link !== null)
  const createCode = useCreateTelegramLinkCode()
  const disconnect = useDisconnectTelegram()

  const connected = status?.connected ?? false

  // Once the bot has confirmed the link there is nothing left to do with the
  // code, and leaving it on screen keeps the status polling alive.
  useEffect(() => {
    if (connected) setLink(null)
  }, [connected])

  if (!status?.enabled) return null

  return (
    <div className="space-y-3 border-t border-gray-100 pt-5">
      <div>
        <h3 className="font-medium text-gray-900">Telegram notifications</h3>
        <p className="mt-1 text-gray-500">
          Get the same alerts as the in-app bell delivered straight to Telegram.
        </p>
      </div>

      {connected
        ? <ConnectedState onDisconnect={() => disconnect.mutate()} pending={disconnect.isPending} />
        : (
          <DisconnectedState
            link={link}
            onGenerate={() => createCode.mutate(undefined, { onSuccess: setLink })}
            pending={createCode.isPending}
            failed={createCode.isError}
          />
        )}
    </div>
  )
}
