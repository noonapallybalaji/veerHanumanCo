import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activeServices } from '../../data'
import { paths, serviceUrl } from '../../lib/paths'
import { Button } from '../ui/Button'
import { ProductVisual } from '../visuals/ProductVisual'

/**
 * Landscaping band. Greener and more natural than the rest of the page,
 * but still using the same type, spacing and card language so it reads as
 * part of Veer Hanuman rather than a separate company.
 */
export function LandscapingSection() {
  const service = activeServices.find((item) => item.slug === 'landscaping')
  if (!service) return null

  return (
    <section id="landscaping" className="border-t border-concrete-200 bg-moss-100">
      <div className="shell grid items-stretch gap-0 py-0 lg:grid-cols-2">
        <div className="order-2 py-14 lg:order-1 lg:py-20 lg:pr-12">
          <p className="eyebrow mb-4 text-moss-700 before:bg-moss/50">Services</p>
          <h2 className="text-[28px] leading-[1.1] sm:text-[34px] lg:text-[40px]">
            Landscaping for project and campus sites
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-charcoal-600">
            {service.summary} Scope is agreed against the site, and can be combined with supply of
            related products such as RCC tree guards and drainage piping for planted areas.
          </p>

          <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {service.scope.map((item) => (
              <li key={item.title} className="flex items-start gap-2.5 text-sm text-charcoal">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
                {item.title}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button to={serviceUrl(service)} variant="primary" size="lg">
              View landscaping
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button to={paths.requestQuote} variant="outline" size="lg">
              Discuss your requirement
            </Button>
          </div>
        </div>

        <div className="group relative order-1 min-h-[260px] overflow-hidden border-x border-moss/15 lg:order-2 lg:min-h-[480px]">
          <div className="absolute inset-0 transition-transform duration-700 ease-subtle group-hover:scale-105">
            <ProductVisual variant="landscaping" alt="" />
          </div>
          <Link
            to={serviceUrl(service)}
            className="absolute inset-0"
            aria-label="View landscaping service"
          />
        </div>
      </div>
    </section>
  )
}
