import type { JSX } from 'react'
import { useState } from 'react'
import { GUIDE_CONTENT, GUIDE_UI_STRINGS, type GuideLang } from '@/lib/guide-content'
import GuideToc from '@/components/guide/GuideToc'
import GuideSectionView from '@/components/guide/GuideSectionView'
import GuideLanguageToggle from '@/components/guide/GuideLanguageToggle'

export default function GuidePage(): JSX.Element {
  const [lang, setLang] = useState<GuideLang>('en')
  const sections = GUIDE_CONTENT[lang]
  const ui = GUIDE_UI_STRINGS[lang]
  const appUrl = window.location.origin

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{ui.pageTitle}</h1>
            <p className="mt-2 text-sm text-gray-500">{ui.pageSubtitle}</p>
            <p className="mt-2 text-sm text-gray-500">
              {ui.appUrlLabel}: <a href={`${appUrl}/register`} className="font-medium text-gray-900 underline">{appUrl}</a>
            </p>
          </div>
          <GuideLanguageToggle lang={lang} onChange={setLang} />
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
          <aside className="sm:order-1">
            <GuideToc sections={sections} heading={ui.tocHeading} />
          </aside>

          <main className="space-y-6 sm:order-2">
            {sections.map((section) => (
              <GuideSectionView key={section.id} section={section} />
            ))}
          </main>
        </div>
      </div>
    </div>
  )
}
