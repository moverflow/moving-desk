import type { JSX } from 'react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordFieldProps {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string | null
}

export default function PasswordField({
  id,
  label = 'Password',
  value,
  onChange,
  error = null,
}: PasswordFieldProps): JSX.Element {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
