import type { JSX } from 'react'
import { Button } from '@/components/ui/button'

export default function PaySuccessPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg border w-full max-w-md p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-semibold">Payment successful!</h1>
        <p className="text-sm text-gray-500">
          Thank you for your payment. A confirmation has been sent to your email.
        </p>
        <Button variant="outline" onClick={() => window.close()}>
          Close this page
        </Button>
      </div>
    </div>
  )
}
