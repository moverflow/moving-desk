import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/hooks/useAuth'

export default function CrewLoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { mutate, isPending } = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    mutate(
      { email, password },
      {
        onSuccess: () => navigate('/crew', { replace: true }),
        onError: () => setError('Invalid email or password'),
      },
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center bg-gray-50 px-6 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-center mb-8">
          <span className="text-2xl font-semibold select-none">
            Moving<strong style={{ color: '#1d9e75' }}>Desk</strong>
          </span>
          <p className="text-base text-muted-foreground mt-2">Welcome, crew member</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Log in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
