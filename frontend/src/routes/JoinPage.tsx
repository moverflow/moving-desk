import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthCard from '@/components/shared/AuthCard'
import PasswordField from '@/components/shared/PasswordField'
import { useJoin } from '@/hooks/useAuth'

export default function JoinPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { mutate, isPending } = useJoin()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    mutate(
      { name, password, token },
      {
        onSuccess: () => navigate('/orders'),
        onError: () => setError('This invite link is invalid or expired'),
      },
    )
  }

  return (
    <AuthCard subtitle="You're joining Best & Pro Moving">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PasswordField id="password" value={password} onChange={setPassword} />
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Joining...' : 'Join team'}
        </Button>
      </form>
    </AuthCard>
  )
}
