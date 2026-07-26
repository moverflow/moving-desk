import type { FormEvent, JSX } from 'react'
import { useState } from 'react'
import { MessageSquareText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSubmitFeedback } from '@/hooks/useFeedback'
import type { FeedbackSeverity } from '@/types'

const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' },
]

interface FeedbackFormProps {
  message: string
  onMessageChange: (message: string) => void
  severity: FeedbackSeverity
  onSeverityChange: (severity: FeedbackSeverity) => void
  isPending: boolean
  isError: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

function FeedbackForm({
  message,
  onMessageChange,
  severity,
  onSeverityChange,
  isPending,
  isError,
  onSubmit,
}: FeedbackFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <Textarea
        required
        autoFocus
        placeholder="What happened, or what would help?"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        rows={4}
      />
      <label className="block text-xs text-muted-foreground">
        Type
        <select
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value as FeedbackSeverity)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      {isError && <p className="text-sm text-destructive">Couldn't send that — please try again.</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || message.trim().length === 0}>
          {isPending ? 'Sending...' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}

interface FeedbackModalProps {
  onClose: () => void
  submitted: boolean
  message: string
  onMessageChange: (message: string) => void
  severity: FeedbackSeverity
  onSeverityChange: (severity: FeedbackSeverity) => void
  isPending: boolean
  isError: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

function FeedbackModal({ onClose, submitted, ...form }: FeedbackModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 id="feedback-modal-title" className="text-base font-semibold text-gray-900">
            Report an issue
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Thanks, we got it!</p>
        ) : (
          <FeedbackForm {...form} />
        )}
      </div>
    </div>
  )
}

export default function FeedbackButton(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<FeedbackSeverity>('bug')
  const [submitted, setSubmitted] = useState(false)
  const { mutate, isPending, isError, reset } = useSubmitFeedback()

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    // Reopening starts a fresh report; a failed attempt's text is not cleared
    // by this, since that only runs when the modal transitions to open.
    if (next) {
      setSubmitted(false)
      reset()
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    mutate(
      { message, pageUrl: window.location.pathname, severity },
      { onSuccess: () => { setSubmitted(true); setMessage('') } },
    )
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => handleOpenChange(true)}
        className="fixed bottom-4 right-4 z-30 gap-1.5 rounded-full shadow-md sm:rounded-md"
        aria-label="Report issue"
      >
        <MessageSquareText className="h-4 w-4" />
        <span className="hidden sm:inline">Report issue</span>
      </Button>

      {open && (
        <FeedbackModal
          onClose={() => handleOpenChange(false)}
          submitted={submitted}
          message={message}
          onMessageChange={setMessage}
          severity={severity}
          onSeverityChange={setSeverity}
          isPending={isPending}
          isError={isError}
          onSubmit={handleSubmit}
        />
      )}
    </>
  )
}
