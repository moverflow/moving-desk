import type { FormEvent, JSX } from 'react'
import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
      <SheetFooter>
        <Button type="submit" disabled={isPending || message.trim().length === 0}>
          {isPending ? 'Sending...' : 'Submit'}
        </Button>
      </SheetFooter>
    </form>
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
    // by this, since that only runs when the sheet transitions to open.
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

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Report an issue</SheetTitle>
            <SheetDescription className="sr-only">
              Send a quick bug report or suggestion to the MovingDesk team
            </SheetDescription>
          </SheetHeader>

          {submitted ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Thanks, we got it!</p>
          ) : (
            <FeedbackForm
              message={message}
              onMessageChange={setMessage}
              severity={severity}
              onSeverityChange={setSeverity}
              isPending={isPending}
              isError={isError}
              onSubmit={handleSubmit}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
