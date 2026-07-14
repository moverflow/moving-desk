import type { JSX } from 'react'
import type { Order } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { useSendContract } from '@/hooks/useOrders'
import { useOrderFiles } from '@/hooks/useOrderFiles'

interface ContractSectionProps {
  order: Order
}

export default function ContractSection({ order }: ContractSectionProps): JSX.Element {
  const send = useSendContract()
  const { data: files = [] } = useOrderFiles(order.id)
  const contractFile = files.find((f) => f.name.includes('contract'))

  function handleSend(): void {
    send.mutate(order.id)
  }

  return (
    <div className="mt-6 space-y-2">
      <Label>Contract</Label>
      {order.contractStatus === 'signed' ? (
        <div className="space-y-1 text-sm">
          <p className="text-green-600">
            Signed{order.contractSignedName ? ` by ${order.contractSignedName}` : ''}
            {order.contractSignedAt
              ? ` on ${formatDate(new Date(order.contractSignedAt))}`
              : ''}
          </p>
          {contractFile && (
            <a
              href={contractFile.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              View signed contract
            </a>
          )}
        </div>
      ) : order.contractStatus === 'sent' ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Waiting for signature</span>
          <Button variant="outline" size="sm" onClick={handleSend} disabled={send.isPending}>
            {send.isPending ? 'Sending...' : 'Resend'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Not sent</span>
          {order.status !== 'new' && (
            <Button variant="outline" size="sm" onClick={handleSend} disabled={send.isPending}>
              {send.isPending ? 'Sending...' : 'Send contract'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
