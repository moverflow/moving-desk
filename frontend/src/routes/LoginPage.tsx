import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthCard from '@/components/shared/AuthCard'
import PasswordField from '@/components/shared/PasswordField'
import { useLogin } from '@/hooks/useAuth'

export default function LoginPage(): JSX.Element {
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
        onSuccess: () => navigate('/orders'),
        onError: () => setError('Invalid email or password'),
      },
    )
  }

  return (
    <AuthCard subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <PasswordField id="password" value={password} onChange={setPassword} />
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in...' : 'Log in'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-foreground hover:underline">Start free trial</Link>
      </p>
    </AuthCard>
  )
}
