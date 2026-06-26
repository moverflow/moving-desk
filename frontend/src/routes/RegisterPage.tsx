import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthCard from '@/components/shared/AuthCard'
import PasswordField from '@/components/shared/PasswordField'
import { useRegister } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'

export default function RegisterPage(): JSX.Element {
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    mutate(
      { companyName, name, email, password },
      {
        onSuccess: () => navigate('/setup'),
        onError: (err) => {
          if (err instanceof ApiError && err.fieldErrors) {
            setFieldErrors(err.fieldErrors)
            return
          }
          setError(err instanceof Error ? err.message : 'Something went wrong')
        },
      },
    )
  }

  return (
    <AuthCard subtitle="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            type="text"
            required
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value)
              if (fieldErrors.companyName) setFieldErrors((prev) => ({ ...prev, companyName: '' }))
            }}
          />
          {fieldErrors.companyName && <p className="text-sm text-destructive">{fieldErrors.companyName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }))
            }}
          />
          {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
          />
          {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
        </div>
        <PasswordField
          id="password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
          }}
          error={fieldErrors.password || null}
        />
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
