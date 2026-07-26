import type { JSX } from 'react'
import type { GuideSection } from '@/lib/guide-content'

interface GuideTocProps {
  sections: GuideSection[]
  heading: string
}

export default function GuideToc({ sections, heading }: GuideTocProps): JSX.Element {
  return (
    <nav aria-label={heading} className="sticky top-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{heading}</p>
      <ul className="flex gap-3 overflow-x-auto pb-2 text-sm sm:flex-col sm:gap-1.5 sm:overflow-visible sm:pb-0">
        {sections.map((section, i) => (
          <li key={section.id} className="shrink-0 sm:shrink">
            <a
              href={`#${section.id}`}
              className="block whitespace-nowrap rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 sm:whitespace-normal"
            >
              {i + 1}. {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
