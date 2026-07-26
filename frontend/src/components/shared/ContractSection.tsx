import type { JSX } from 'react'
import { useState } from 'react'
import type { Order } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatTimestamp } from '@/lib/utils'
import { useSendContract } from '@/hooks/useOrders'
import { useOrderFiles } from '@/hooks/useOrderFiles'

interface ContractSectionProps {
  order: Order
}

// Resend goes through the same Resend sandbox restriction as every other
// email in this app (see .claude/tasks/audit/email-delivery-findings.md) —
// this is the only reliable way to actually hand a real client the signing
// link. Mirrors BookingTab's "Copy link" pattern.
function ContractLinkControls({ contractUrl }: { contractUrl: string }): JSX.Element {
  const [copied, setCopied] = useState(false)

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(contractUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code className="text-xs bg-gray-100 rounded px-2 py-1.5 text-gray-700 break-all flex-1 min-w-[200px]">
        {contractUrl}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy link'}
      </Button>
    </div>
  )
}

interface SignedContractProps {
  order: Order
  contractFileUrl?: string
}

function SignedContract({ order, contractFileUrl }: SignedContractProps): JSX.Element {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-green-600">
        Signed{order.contractSignedName ? ` by ${order.contractSignedName}` : ''}
        {order.contractSignedAt ? ` on ${formatTimestamp(new Date(order.contractSignedAt))}` : ''}
      </p>
      {contractFileUrl && (
        <a
          href={contractFileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          View signed contract
        </a>
      )}
    </div>
  )
}

interface SentContractProps {
  contractUrl: string | null
  isPending: boolean
  onResend: () => void
}

function SentContract({ contractUrl, isPending, onResend }: SentContractProps): JSX.Element {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Waiting for signature</span>
        <Button variant="outline" size="sm" onClick={onResend} disabled={isPending}>
          {isPending ? 'Sending...' : 'Resend'}
        </Button>
      </div>
      {contractUrl && <ContractLinkControls contractUrl={contractUrl} />}
    </div>
  )
}

interface NotSentContractProps {
  canSend: boolean
  isPending: boolean
  onSend: () => void
}

function NotSentContract({ canSend, isPending, onSend }: NotSentContractProps): JSX.Element {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">Not sent</span>
      {canSend && (
        <Button variant="outline" size="sm" onClick={onSend} disabled={isPending}>
          {isPending ? 'Sending...' : 'Send contract'}
        </Button>
      )}
    </div>
  )
}

export default function ContractSection({ order }: ContractSectionProps): JSX.Element {
  const send = useSendContract()
  const { data: files = [] } = useOrderFiles(order.id)
  const contractFile = files.find((f) => f.name.includes('contract'))
  const contractUrl = order.contractToken ? `${window.location.origin}/contract/${order.contractToken}` : null

  function handleSend(): void {
    send.mutate(order.id)
  }

  return (
    <div className="mt-6 space-y-2">
      <Label>Contract</Label>
      {order.contractStatus === 'signed' ? (
        <SignedContract order={order} contractFileUrl={contractFile?.url} />
      ) : order.contractStatus === 'sent' ? (
        <SentContract contractUrl={contractUrl} isPending={send.isPending} onResend={handleSend} />
      ) : (
        <NotSentContract canSend={order.status !== 'new'} isPending={send.isPending} onSend={handleSend} />
      )}
    </div>
  )
}
