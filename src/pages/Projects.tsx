import { ArrowRight, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { ProductVisual, Visual } from '../components/visuals/ProductVisual'
import { getApplicationIcon } from '../components/visuals/icons'
import {
  activeProjects,
  applications,
  countMatchesByApplication,
  getProductById,
  productDisplayName,
} from '../data'
import { applicationUrl, paths } from '../lib/paths'
import { breadcrumbSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

/**
 * Projects page.
 *
 * No verified project references were supplied. Rather than invent clients,
 * values, quantities, locations, completion counts or testimonials, the page
 * says plainly that the portfolio is in preparation and spends its space on
 * something genuinely useful instead: the application contexts the catalogue
 * is supplied into, each linking to the matching products.
 *
 * Add entries to data/projects.ts and this page switches to a real project
 * grid automatically.
 */
export default function Projects() {
  const hasProjects = activeProjects.length > 0

  return (
    <>
      <Seo
        title="Projects & Applications"
        description="See the project types Veer Hanuman Trading Co. supplies RCC, FRP and piping products into — road and infrastructure, drainage, residential, commercial, industrial and landscaping work."
        path={paths.projects}
        schema={breadcrumbSchema([
          { name: 'Home', path: paths.home },
          { name: 'Projects', path: paths.projects },
        ])}
      />

      <PageHeader
        crumbs={[{ name: 'Home', path: paths.home }, { name: 'Projects' }]}
        eyebrow="Projects"
        title={hasProjects ? 'Project references' : 'Products in real-world applications'}
        intro={
          hasProjects
            ? 'Project references supplied by the business, grouped by application.'
            : 'Our project portfolio is being prepared. Until verified project details and site photographs are available, this page sets out the project types our products are supplied into — and what we can supply for each.'
        }
        actions={
          <>
            <Button to={paths.products} variant="accent" size="lg">
              Explore products
            </Button>
            <Button to={paths.requestQuote} variant="onDark" size="lg">
              Discuss your project
            </Button>
          </>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <ProductVisual variant="infrastructure" alt="" tone="dark" />
            </div>
          </div>
        }
      />

      {hasProjects ? (
        <Section tone="cream">
          <SectionHeading
            eyebrow={`${activeProjects.length} ${activeProjects.length === 1 ? 'reference' : 'references'}`}
            title="Project references"
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <li key={project.id} className="flex">
                <article className="group relative flex w-full flex-col border border-concrete-200 bg-cream-100 transition-shadow hover:shadow-card">
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-concrete-200">
                    <Visual
                      variant={project.visual}
                      image={project.image}
                      alt={project.title}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg leading-snug">
                      <Link
                        to={`${paths.projects}/${project.slug}`}
                        className="rounded-sm after:absolute after:inset-0 after:content-['']"
                      >
                        {project.title}
                      </Link>
                    </h3>
                    {project.location && (
                      <p className="mt-1 text-[13px] text-concrete">{project.location}</p>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-concrete-700">
                      {project.summary}
                    </p>
                    {project.products.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {project.products.map((productId) => {
                          const product = getProductById(productId)
                          if (!product) return null
                          return (
                            <li
                              key={productId}
                              className="rounded-sm bg-cream-300 px-2 py-0.5 text-[11px] font-medium text-concrete-700"
                            >
                              {productDisplayName(product)}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section tone="cream">
          <div className="flex items-start gap-3 border border-concrete-200 bg-cream-100 p-5 sm:p-6">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
            <div>
              <h2 className="text-base">Project portfolio in preparation</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-concrete-700">
                We would rather publish nothing than publish project claims we cannot stand behind.
                Verified project references, locations and site photographs will be added here as
                they are confirmed. In the meantime, the illustrations on this page show typical
                application contexts for the product range — they are not photographs of company
                work.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-concrete-700">
                If you would like references relevant to a specific project type, ask us directly
                and we will discuss what we can share.
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* Application-led showcase: genuinely useful, no invented data. */}
      <Section tone="concrete" divided>
        <SectionHeading
          eyebrow="By application"
          title="Where our products are used"
          intro="Six project types the catalogue is supplied into. Each one opens the matching products."
        />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((application, index) => {
            const Icon = getApplicationIcon(application.icon)
            const count = countMatchesByApplication(application.slug)
            // Rotate through illustrations so no two adjacent tiles repeat.
            const visuals = [
              'infrastructure',
              'pipe-dwc',
              'rcc-chamber',
              'rcc-manhole-cover',
              'pipe-hdpe',
              'landscaping',
            ] as const

            return (
              <li key={application.slug} className="flex">
                <article className="group relative flex min-h-[320px] w-full flex-col justify-end overflow-hidden border border-charcoal/10 bg-charcoal text-cream on-dark">
                  <div aria-hidden="true" className="absolute inset-0">
                    <div className="h-full w-full transition-transform duration-700 ease-subtle group-hover:scale-105">
                      <ProductVisual variant={visuals[index % visuals.length]} alt="" />
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
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-terracotta-400">
                      {count} matching {count === 1 ? 'item' : 'items'}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </p>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </Section>

      <QuoteCta />
    </>
  )
}
