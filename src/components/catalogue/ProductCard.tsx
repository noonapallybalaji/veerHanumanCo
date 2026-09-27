import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCategoryForProduct, productDisplayName, resolveApplications } from '../../data'
import type { Product } from '../../data/types'
import { cn } from '../../lib/cn'
import { productUrl, quoteUrlFor } from '../../lib/paths'
import { Visual } from '../visuals/ProductVisual'

interface ProductCardProps {
  product: Product
  /** Hide the category label where the surrounding context already says it. */
  showCategory?: boolean
  className?: string
}

/**
 * The whole card is a single link to the product page (stretched-link
 * pattern), with the quote action layered above it. One link per card keeps
 * the tab order short and screen-reader output clean.
 *
 * Deliberately no WhatsApp button here — per the CTA strategy, the card's
 * secondary action is "Get a Quote" and WhatsApp lives on the detail page.
 */
export function ProductCard({ product, showCategory = true, className }: ProductCardProps) {
  const category = getCategoryForProduct(product)
  const name = productDisplayName(product)
  const applications = resolveApplications(product.applications).slice(0, 3)

  return (
    <article
      className={cn(
        'group relative flex flex-col border border-concrete-200 bg-cream-100 transition-shadow duration-300 ease-subtle hover:shadow-card focus-within:shadow-card',
        className,
      )}
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-concrete-200 bg-cream-300">
        <div className="h-full w-full transition-transform duration-500 ease-subtle group-hover:scale-[1.03]">
          <Visual variant={product.visual} image={product.image} alt={name} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {showCategory && category && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">
            {category.name}
          </p>
        )}
        <h3 className="text-lg leading-snug">
          <Link
            to={productUrl(product)}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-concrete-700">{product.summary}</p>

        {applications.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {applications.map((application) => (
              <li
                key={application.slug}
                className="rounded-sm bg-cream-300 px-2 py-0.5 text-[11px] font-medium text-concrete-700"
              >
                {application.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-concrete-200 px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal">
          View details
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
        <Link
          to={quoteUrlFor(name)}
          className="rounded-sm border border-charcoal/20 px-3 py-1.5 text-[13px] font-semibold text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-cream"
        >
          Get a Quote
          <span className="sr-only"> for {name}</span>
        </Link>
      </div>
    </article>
  )
}
