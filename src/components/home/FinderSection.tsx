import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getMatchesByRequirementTag, requirementTagBySlug } from '../../data'
import { finderUrl } from '../../lib/paths'
import { MatchGrid } from '../catalogue/MatchGrid'
import { RequirementFinder } from '../discovery/RequirementFinder'
import { Section, SectionHeading } from '../ui/Section'

/**
 * Homepage requirement finder. Results appear inline so a visitor who does
 * not know the product name still lands on a real product within one click.
 */
export function FinderSection() {
  const [selected, setSelected] = useState<string | null>(null)
  const tag = selected ? requirementTagBySlug.get(selected) : undefined
  const matches = selected ? getMatchesByRequirementTag(selected) : []

  return (
    <Section id="requirement-finder" tone="concrete" divided>
      <SectionHeading
        eyebrow="Requirement finder"
        title="What are you looking for?"
        intro="Start with the application if you do not know the exact product name."
      />

      <RequirementFinder value={selected} onChange={setSelected} />

      <div aria-live="polite" className="mt-10">
        {tag ? (
          <div className="animate-fade-up">
            <div className="mb-6 flex flex-col gap-3 border-t border-concrete-300 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg">
                {matches.length} {matches.length === 1 ? 'match' : 'matches'} for{' '}
                <span className="text-terracotta">{tag.name}</span>
              </h3>
              <Link
                to={finderUrl(tag.slug)}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-charcoal hover:text-terracotta"
              >
                Open in full catalogue
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <MatchGrid matches={matches} />
          </div>
        ) : (
          <p className="border-t border-concrete-300 pt-6 text-sm text-concrete-700">
            Select a requirement above to see matching products and services.
          </p>
        )}
      </div>
    </Section>
  )
}
