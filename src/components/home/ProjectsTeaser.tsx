import { ArrowRight, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activeProjects, applicationBySlug } from '../../data'
import { cn } from '../../lib/cn'
import { applicationUrl, paths } from '../../lib/paths'
import { Section, SectionHeading } from '../ui/Section'
import { ProductVisual, Visual } from '../visuals/ProductVisual'
import type { VisualVariant } from '../../data/types'

/**
 * Homepage projects teaser.
 *
 * Two modes:
 *  - Published projects exist -> show the real ones (featured first),
 *    each linking to its detail page.
 *  - None yet -> fall back to the application contexts the products are
 *    used in, and say plainly that the portfolio is being prepared.
 *
 * The fallback never presents an illustration as a photograph of company
 * work, and invents no clients, values or counts.
 */
const contexts: { slug: string; visual: VisualVariant }[] = [
  { slug: 'road-infrastructure', visual: 'infrastructure' },
  { slug: 'drainage-systems', visual: 'pipe-dwc' },
  { slug: 'commercial-construction', visual: 'rcc-manhole-cover' },
  { slug: 'landscaping', visual: 'landscaping' },
]

export function ProjectsTeaser() {
  const hasProjects = activeProjects.length > 0
  // Featured first, then whatever order the admin set.
  const featured = [...activeProjects]
    .sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false))
    .slice(0, 4)

  return (
    <Section id="projects" tone="concrete" divided>
      <SectionHeading
        eyebrow="Products in application"
        title="Where our products end up"
        intro={
          hasProjects
            ? 'A selection of project references. Open the projects page for the full list.'
            : 'Our project portfolio is being prepared. In the meantime, these are the project types the catalogue is most often supplied into.'
        }
        action={
          <Link
            to={paths.projects}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-charcoal hover:text-terracotta"
          >
            View projects page
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />

      {/* Real published projects take precedence over the fallback tiles. */}
      {hasProjects && (
        <ul
          className={cn(
            'grid grid-cols-1 gap-5 sm:grid-cols-2',
            // A lone card stranded in a four-column grid reads as a mistake,
            // so the track count follows how many there actually are.
            featured.length >= 4 && 'lg:grid-cols-4',
            featured.length === 3 && 'lg:grid-cols-3',
            featured.length <= 2 && 'lg:grid-cols-2',
          )}
        >
          {featured.map((project) => (
            <li key={project.id} className="flex">
              <article className="group relative flex min-h-[260px] w-full flex-col justify-end overflow-hidden border border-charcoal/10 bg-charcoal text-cream on-dark">
                <div aria-hidden="true" className="absolute inset-0">
                  <div className="h-full w-full transition-transform duration-700 ease-subtle group-hover:scale-105">
                    <Visual variant={project.visual} image={project.image} alt="" />
                  </div>
                  <div className="overlay-scrim absolute inset-0" />
                </div>
                <div className="z-10 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta-400">
                    {project.projectType || 'Project'}
                  </p>
                  <h3 className="mt-2 text-lg leading-snug">
                    <Link
                      to={`${paths.projects}/${project.slug}`}
                      className="rounded-sm after:absolute after:inset-0 after:content-['']"
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-cream/65">
                    {project.summary}
                  </p>
                  {(project.location || project.year) && (
                    <p className="mt-2 text-[11.5px] text-cream/45">
                      {[project.location, project.year].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {!hasProjects && (
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {contexts.map((context) => {
          const application = applicationBySlug.get(context.slug)
          if (!application) return null
          return (
            <li key={context.slug} className="flex">
              <article className="group relative flex min-h-[260px] w-full flex-col justify-end overflow-hidden border border-charcoal/10 bg-charcoal text-cream on-dark">
                <div aria-hidden="true" className="absolute inset-0">
                  <div className="h-full w-full transition-transform duration-700 ease-subtle group-hover:scale-105">
                    <ProductVisual variant={context.visual} alt="" />
                  </div>
                  <div className="overlay-scrim absolute inset-0" />
                </div>
                {/* Static + z-10 so the stretched link covers the whole card. */}
                <div className="z-10 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta-400">
                    Application
                  </p>
                  <h3 className="mt-2 text-lg leading-snug">
                    <Link
                      to={applicationUrl(application.slug)}
                      className="rounded-sm after:absolute after:inset-0 after:content-['']"
                    >
                      {application.name}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-cream/60">
                    See matching products
                  </p>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
      )}

      {!hasProjects && (
        <p className="mt-6 flex items-start gap-2.5 border border-concrete-300 bg-cream-100 p-4 text-[13px] leading-relaxed text-concrete-700">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-concrete" />
          <span>
            The illustrations above show typical application contexts for the product range. Project
            references and site photographs will be published once verified details are available.
          </span>
        </p>
      )}
    </Section>
  )
}
