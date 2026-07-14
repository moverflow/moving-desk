import type { JSX } from 'react'
import type { PublicContract } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { STANDARD_CONTRACT_TERMS } from './terms'

interface ContractContentProps {
  order: PublicContract['order']
  company: PublicContract['company']
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  )
}

export default function ContractContent({ order, company }: ContractContentProps): JSX.Element {
  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Move details
        </h3>
        <div className="rounded-lg border border-gray-200 px-4 py-2 divide-y divide-gray-100">
          <DetailRow label="From" value={order.fromAddress} />
          <DetailRow label="To" value={order.toAddress} />
          <DetailRow label="Date" value={order.moveDate} />
          <DetailRow label="Size" value={order.homeSize} />
          <DetailRow label="Packing" value={order.packing ? 'Yes' : 'No'} />
          <DetailRow label="Price" value={formatCurrency(order.totalPrice)} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Standard terms
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-gray-600">
          {STANDARD_CONTRACT_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ol>
      </section>

      {company.contractTerms && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {company.name} terms
          </h3>
          <p className="whitespace-pre-wrap text-gray-600">{company.contractTerms}</p>
        </section>
      )}
    </div>
  )
}
