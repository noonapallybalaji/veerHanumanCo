import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { applications, countMatchesByApplication } from '../../data'
import { applicationUrl } from '../../lib/paths'
import { Section, SectionHeading } from '../ui/Section'
import { getApplicationIcon } from '../visuals/icons'
import { ProductVisual } from '../visuals/ProductVisual'

/**
 * Applications are a discovery dimension, not catalogue categories.
 *
 * Layout is deliberately asymmetric — two lead cards with imagery and four
 * compact rows — so this does not read as six identical tiles, and so the
 * two most common project types carry the most visual weight.
 */
export function ApplicationsSection() {
  const [lead, second, ...rest] = applications
  const leadCards = [
    { application: lead, visual: 'infrastructure' as const },
    { application: second, visual: 'frp-thermodrain' as const },
  ]

  return (
    <Section id="applications" tone="cream" divided>
      <SectionHeading
        eyebrow="Applications"
        title="Where these products are used"
        intro="The same product often serves several project types. Pick the closest application to see what we can supply for it."
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <ul className="grid gap-5 sm:grid-cols-2">
          {leadCards.map(({ application, visual }) => {
            const Icon = getApplicationIcon(application.icon)
            const count = countMatchesByApplication(application.slug)
            return (
              <li key={application.slug} className="flex">
                <article className="group relative flex min-h-[300px] w-full flex-col justify-end overflow-hidden border border-charcoal/10 bg-charcoal text-cream on-dark">
                  <div aria-hidden="true" className="absolute inset-0">
                    <div className="h-full w-full transition-transform duration-700 ease-subtle group-hover:scale-105">
                      <ProductVisual variant={visual} alt="" />
                    </div>
                    <div className="overlay-scrim absolute inset-0" />
                  </div>
                  {/* Static + z-10 so the stretched link covers the whole card. */}
                  <div className="z-10 p-5">
                    <Icon aria-hidden="true" className="h-5 w-5 text-terracotta-400" />
                    <h3 className="mt-3 text-xl leading-snug">
                      <Link
                        to={applicationUrl(application.slug)}
                        className="rounded-sm after:absolute after:inset-0 after:content-['']"
                      >
                        {application.name}
                      </Link>
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-cream/65">
                      {application.description}
                    </p>
                    <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-cream/45">
                      {count} matching {count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>

        <ul className="divide-y divide-concrete-200 border border-concrete-200 bg-cream-100">
          {rest.map((application) => {
            const Icon = getApplicationIcon(application.icon)
            const count = countMatchesByApplication(application.slug)
            return (
              <li key={application.slug}>
                <Link
                  to={applicationUrl(application.slug)}
                  className="group flex items-start gap-4 p-5 transition-colors hover:bg-cream-200"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-concrete-200 bg-cream text-terracotta"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-display text-base font-extrabold text-charcoal">
                        {application.name}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-concrete transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-charcoal"
                      />
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-concrete-700">
                      {application.description}
                    </span>
                    <span className="mt-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-concrete">
                      {count} matching {count === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}
