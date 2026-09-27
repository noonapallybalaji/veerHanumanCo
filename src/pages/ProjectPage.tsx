import { ArrowLeft, Quote } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ProductCard } from '../components/catalogue/ProductCard'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { Visual } from '../components/visuals/ProductVisual'
import { activeProjects, getProductById } from '../data'
import type { Product } from '../data/types'
import { paths } from '../lib/paths'
import { breadcrumbSchema } from '../lib/schema'
import { Seo } from '../lib/seo'
import NotFound from './NotFound'

/**
 * Project detail page.
 *
 * Only published projects reach the client, so an unknown slug is a genuine
 * 404. Client name, testimonial and quantity are rendered only when the API
 * supplied them — consent gating happens server-side, so anything private is
 * simply absent here rather than conditionally hidden.
 */
export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>()
  const project = activeProjects.find((item) => item.slug === slug)

  if (!project) return <NotFound />

  const path = `${paths.projects}/${project.slug}`
  const products = (project.products ?? [])
    .map((id) => getProductById(id))
    .filter((product): product is Product => Boolean(product))

  const facts = [
    project.projectType && { label: 'Project type', value: project.projectType },
    project.location && { label: 'Location', value: project.location },
    project.year && { label: 'Completed', value: String(project.year) },
    project.client && { label: 'Client', value: project.client },
    project.quantitySupplied && { label: 'Quantity supplied', value: project.quantitySupplied },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <>
      <Seo
        title={project.title}
        description={project.summary}
        path={path}
        image={project.image ?? undefined}
        schema={breadcrumbSchema([
          { name: 'Home', path: paths.home },
          { name: 'Projects', path: paths.projects },
          { name: project.title, path },
        ])}
      />

      <PageHeader
        crumbs={[
          { name: 'Home', path: paths.home },
          { name: 'Projects', path: paths.projects },
          { name: project.title },
        ]}
        eyebrow="Project"
        title={project.title}
        intro={project.summary}
        actions={
          <Button to={paths.requestQuote} variant="accent" size="lg">
            Discuss a similar requirement
          </Button>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <Visual
                variant={project.visual}
                image={project.image}
                alt={project.title}
                tone="dark"
                loading="eager"
              />
            </div>
          </div>
        }
      />

      <Section tone="cream">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-[22px] sm:text-[26px]">About this project</h2>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-charcoal-600">
              {project.description}
            </p>

            {project.scope && (
              <>
                <h3 className="mt-8 text-lg">Scope of supply</h3>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-charcoal-600">
                  {project.scope}
                </p>
              </>
            )}

            {project.testimonial && (
              <figure className="mt-9 border-l-2 border-terracotta bg-cream-100 p-6">
                <Quote aria-hidden="true" className="h-5 w-5 text-terracotta" />
                <blockquote className="mt-3 text-[16px] leading-relaxed text-charcoal">
                  {project.testimonial.quote}
                </blockquote>
                {project.testimonial.author && (
                  <figcaption className="mt-3 text-[13px] font-semibold text-concrete-700">
                    {project.testimonial.author}
                  </figcaption>
                )}
              </figure>
            )}

            {project.gallery && project.gallery.length > 0 && (
              <>
                <h3 className="mt-9 text-lg">Gallery</h3>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {project.gallery.map((image, index) => (
                    <li
                      key={index}
                      className="aspect-[4/3] overflow-hidden border border-concrete-200"
                    >
                      <img
                        src={image.url ?? ''}
                        alt={image.alt || `${project.title} — image ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            {facts.length > 0 && (
              <div className="border border-concrete-200 bg-cream-100 p-6">
                <h2 className="text-lg">Project details</h2>
                <dl className="mt-4 space-y-3.5 text-sm">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-concrete">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-charcoal">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <Button to={paths.projects} variant="outline" size="md" block className="mt-4">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              All projects
            </Button>
          </aside>
        </div>
      </Section>

      {products.length > 0 && (
        <Section tone="concrete" divided>
          <SectionHeading
            eyebrow="Products supplied"
            title="What we supplied to this project"
            intro="Open a product for applications, use cases and enquiry options."
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} className="w-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <QuoteCta />
    </>
  )
}
