import type { JSX } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { GuideBlock, GuideSection } from '@/lib/guide-content'
import GuidePlaceholder from '@/components/guide/GuidePlaceholder'

function GuideBlockView({ block }: { block: GuideBlock }): JSX.Element {
  switch (block.type) {
    case 'p':
      return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
    case 'subheading':
      return <h3 className="text-sm font-semibold text-foreground">{block.text}</h3>
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'placeholder':
      return <GuidePlaceholder label={block.label} />
  }
}

interface GuideSectionViewProps {
  section: GuideSection
}

export default function GuideSectionView({ section }: GuideSectionViewProps): JSX.Element {
  return (
    <section id={section.id} className="scroll-mt-24">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          <div className="mt-4 space-y-3">
            {section.blocks.map((block, i) => (
              <GuideBlockView key={`${section.id}-${i}`} block={block} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
