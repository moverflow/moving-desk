import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthCard from '@/components/shared/AuthCard'
import PasswordField from '@/components/shared/PasswordField'
import { useRegister } from '@/hooks/useAuth'

export default function RegisterPage(): JSX.Element {
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    mutate(
      { companyName, name, email, password },
      {
        onSuccess: () => navigate('/setup'),
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <AuthCard subtitle="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <PasswordField id="password" value={password} onChange={setPassword} />
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account...' : 'Start free trial — 14 days free'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-foreground hover:underline">Log in</Link>
      </p>
    </AuthCard>
  )
}
