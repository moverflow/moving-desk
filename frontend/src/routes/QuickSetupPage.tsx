import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import LogoUpload from '@/components/shared/LogoUpload'
import { useUpdateSettings, useUploadLogo } from '@/hooks/useSettings'
import { getGroupedTimezones } from '@/lib/utils'

export default function QuickSetupPage(): JSX.Element {
  const navigate = useNavigate()
  const [timezone, setTimezone] = useState('America/New_York')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const { mutateAsync: updateSettings, isPending: isSaving } = useUpdateSettings()
  const { mutateAsync: uploadLogo, isPending: isUploading } = useUploadLogo()

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    let logoUrl: string | undefined
    if (logoFile) {
      const result = await uploadLogo(logoFile)
      logoUrl = result.url
    }
    await updateSettings({ timezone, ...(logoUrl !== undefined && { logoUrl }) })
    navigate('/orders')
  }

  const isPending = isSaving || isUploading

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-[480px]">
        <CardHeader className="pb-2">
          <p className="text-xs text-muted-foreground">Step 1 of 1</p>
          <h1 className="text-lg font-semibold mt-1">One quick thing before you start</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <LogoUpload onSkip={() => navigate('/orders')} onFileSelect={setLogoFile} />
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(getGroupedTimezones()).map(([region, timezones]) => (
                    <SelectGroup key={region}>
                      <SelectLabel>{region}</SelectLabel>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Saving...' : 'Let\'s go →'}
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
