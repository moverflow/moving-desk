import type { JSX, FormEvent, ChangeEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TIMEZONES = [
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HT)' },
]

export default function QuickSetupPage(): JSX.Element {
  const navigate = useNavigate()
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('America/New_York')

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoPreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    navigate('/orders')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-[480px]">
        <CardHeader className="pb-2">
          <p className="text-xs text-muted-foreground">Step 1 of 1</p>
          <h1 className="text-lg font-semibold mt-1">One quick thing before you start</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Company logo</Label>
              {logoPreview !== null ? (
                <div className="flex items-center gap-3">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-16 w-16 rounded-md object-cover border"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoPreview(null)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
              )}
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="block text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
              >
                Skip for now
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                Let's go →
              </Button>
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
              >
                Skip setup
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
