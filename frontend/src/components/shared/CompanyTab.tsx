import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BaseRatesFields from './BaseRatesFields'
import LogoField from './LogoField'
import { useSettings, useUpdateSettings, useUploadLogo, useSubscription } from '@/hooks/useSettings'
import { getGroupedTimezones } from '@/lib/utils'

export default function CompanyTab(): JSX.Element {
  const { data: settings } = useSettings()
  const { data: sub } = useSubscription()
  const { mutateAsync: save, isPending: isSaving } = useUpdateSettings()
  const { mutateAsync: uploadLogo, isPending: isUploading } = useUploadLogo()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('America/Los_Angeles')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [rates, setRates] = useState<Record<string, number>>({ studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 })
  const initialized = useRef(false)
  const isReadOnly = sub?.status !== 'trialing' && sub?.status !== 'active'

  useEffect(() => {
    if (settings && !initialized.current) {
      initialized.current = true
      setName(settings.companyName)
      setPhone(settings.phone ?? '')
      setTimezone(settings.timezone)
      setRates({ ...settings.baseRates })
      if (settings.logoUrl) setLogoUrl(settings.logoUrl)
    }
  }, [settings])

  async function handleSave(): Promise<void> {
    let finalLogoUrl = logoUrl
    if (logoFile) {
      const result = await uploadLogo(logoFile)
      finalLogoUrl = result.url
      setLogoFile(null)
    }
    await save({ companyName: name, phone: phone.trim() || null, timezone, logoUrl: finalLogoUrl, baseRates: rates })
  }

  const isPending = isSaving || isUploading

  return (
    <div className="mt-4 space-y-5">
      <LogoField
        initialPreview={logoUrl}
        onPreviewChange={setLogoUrl}
        onFileSelect={setLogoFile}
        disabled={isReadOnly}
      />
      <div className="space-y-1.5">
        <Label htmlFor="companyName">Company name</Label>
        <Input id="companyName" value={name} onChange={(e) => setName(e.target.value)} disabled={isReadOnly} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="companyPhone">Phone</Label>
        <Input id="companyPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(949) 555-0100" disabled={isReadOnly} />
      </div>
      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone} disabled={isReadOnly}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(getGroupedTimezones()).map(([region, timezones]) => (
              <SelectGroup key={region}>
                <SelectLabel>{region}</SelectLabel>
                {timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <BaseRatesFields rates={rates} onChange={(k, v) => setRates((p) => ({ ...p, [k]: v }))} disabled={isReadOnly} />
      <Button onClick={handleSave} disabled={isPending || isReadOnly}>
        {isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )
}
