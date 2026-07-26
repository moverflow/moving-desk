import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import type { GuideLang } from '@/lib/guide-content'

const LANGS: { value: GuideLang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ru', label: 'RU' },
]

interface GuideLanguageToggleProps {
  lang: GuideLang
  onChange: (lang: GuideLang) => void
}

export default function GuideLanguageToggle({ lang, onChange }: GuideLanguageToggleProps): JSX.Element {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-input bg-background p-1" role="group" aria-label="Language">
      {LANGS.map((l) => {
        const active = l.value === lang
        return (
          <Button
            key={l.value}
            type="button"
            size="sm"
            variant={active ? 'default' : 'ghost'}
            aria-pressed={active}
            onClick={() => onChange(l.value)}
          >
            {l.label}
          </Button>
        )
      })}
    </div>
  )
}
