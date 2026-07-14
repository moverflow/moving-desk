import type { JSX } from 'react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import type { PublicContract } from '@/types'
import { usePublicContract, useSignContract, uploadContractPdf } from '@/hooks/useContract'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPersonInitials, formatPhone } from '@/lib/utils'
import ContractContent from '@/components/contract/ContractContent'
import ContractDocument from '@/components/contract/ContractDocument'
import SignaturePad, { type SignaturePadHandle } from '@/components/contract/SignaturePad'

function Spinner(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
    </div>
  )
}

function Shell({ contract, children }: { contract: PublicContract; children: React.ReactNode }): JSX.Element {
  const { company } = contract
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <header className="text-center pb-6 mb-6 border-b border-gray-100">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-16 w-16 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-semibold mx-auto">
                {getPersonInitials(company.name)}
              </div>
            )}
            <h1 className="text-xl font-semibold text-gray-900 mt-3">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Moving Service Agreement</p>
          </header>
          {children}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Powered by MovingDesk</p>
      </div>
    </div>
  )
}

interface SignFormProps {
  token: string
  contract: PublicContract
  onSigned: (signedName: string) => void
}

function SignForm({ token, contract, onSigned }: SignFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [sigError, setSigError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)
  const sign = useSignContract(token)

  async function handleSubmit(): Promise<void> {
    setNameError(null)
    setSigError(null)
    setSubmitError(null)

    const trimmed = name.trim()
    let valid = true
    if (trimmed.length < 2) {
      setNameError('Please enter your full name')
      valid = false
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSigError('Please provide your signature')
      valid = false
    }
    if (!valid) return

    const signatureDataUrl = sigRef.current!.toDataURL()
    setBusy(true)
    try {
      await sign.mutateAsync({ signedName: trimmed, signatureDataUrl })
      try {
        const blob = await pdf(
          <ContractDocument
            contract={contract}
            signedName={trimmed}
            signatureDataUrl={signatureDataUrl}
            signedAt={new Date().toLocaleString('en-US')}
          />,
        ).toBlob()
        await uploadContractPdf(token, blob)
      } catch {
        // PDF is a secondary artifact — the contract is already legally
        // signed, so never block the success screen on an upload failure.
      }
      onSigned(trimmed)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <ContractContent order={contract.order} company={contract.company} />

      <div className="border-t border-gray-100 pt-6 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Client signature
        </h3>

        <div className="space-y-1.5">
          <Label htmlFor="signedName">Full name *</Label>
          <Input
            id="signedName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Signature *</Label>
          <SignaturePad ref={sigRef} />
          <button
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Clear signature
          </button>
          {sigError && <p className="text-sm text-red-600">{sigError}</p>}
        </div>

        <p className="text-xs text-gray-500">By signing, I agree to all terms above.</p>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <Button className="w-full" onClick={handleSubmit} disabled={busy}>
          {busy ? 'Signing...' : 'Sign Contract →'}
        </Button>
      </div>
    </div>
  )
}

function AlreadySigned({ contract }: { contract: PublicContract }): JSX.Element {
  const when = contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : null
  return (
    <div className="text-center py-6">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-lg font-semibold text-gray-900">Contract already signed</h2>
      <p className="text-sm text-gray-500 mt-2">
        This contract was signed
        {contract.signedName ? ` by ${contract.signedName}` : ''}
        {when ? ` on ${when}` : ''}.
      </p>
      <p className="text-sm text-gray-500 mt-1">Thank you!</p>
    </div>
  )
}

function Success({ contract, name }: { contract: PublicContract; name: string }): JSX.Element {
  const { company, order } = contract
  return (
    <div className="text-center py-6">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-lg font-semibold text-gray-900">Contract signed successfully!</h2>
      <p className="text-sm text-gray-500 mt-2">
        Thank you, {name}. Your moving contract has been signed.
      </p>
      <p className="text-sm text-gray-500 mt-4">Move date: {order.moveDate}</p>
      <p className="text-sm text-gray-500 mt-1">{company.name} will be in touch with any updates.</p>
      {company.phone && (
        <p className="text-sm text-gray-500 mt-4">
          Questions? Call:{' '}
          <a href={`tel:${company.phone}`} className="font-medium text-gray-900">
            {formatPhone(company.phone)}
          </a>
        </p>
      )}
    </div>
  )
}

export default function ContractPage(): JSX.Element {
  const { token = '' } = useParams<{ token: string }>()
  const { data: contract, isLoading, isError } = usePublicContract(token)
  const [signedName, setSignedName] = useState<string | null>(null)

  if (isLoading) return <Spinner />

  if (isError || !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">📄</p>
        <h1 className="text-lg font-semibold text-gray-900">Contract not found</h1>
        <p className="text-sm text-gray-500 mt-1">This contract link is invalid or has expired.</p>
      </div>
    )
  }

  return (
    <Shell contract={contract}>
      {signedName ? (
        <Success contract={contract} name={signedName} />
      ) : contract.alreadySigned ? (
        <AlreadySigned contract={contract} />
      ) : (
        <SignForm token={token} contract={contract} onSigned={setSignedName} />
      )}
    </Shell>
  )
}
