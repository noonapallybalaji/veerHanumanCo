import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getProductsByCategory } from '../../data'
import type { ProductCategory } from '../../data/types'
import { cn } from '../../lib/cn'
import { categoryUrl } from '../../lib/paths'
import { Visual } from '../visuals/ProductVisual'

interface CategoryCardProps {
  category: ProductCategory
  className?: string
}

/**
 * Category tile for the homepage and /products. Shows the products inside
 * the category up front so a contractor can tell in one glance whether
 * the family contains what they need.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  const products = getProductsByCategory(category.id)

  return (
    <article
      className={cn(
        'group relative flex min-h-[420px] flex-col justify-end overflow-hidden border border-charcoal/10 bg-charcoal text-cream on-dark',
        className,
      )}
    >
      <div className="absolute inset-0">
        {/* Light-tone artwork under a graduated scrim: the illustration
            stays readable at the top, the text stays readable at the
            bottom. */}
        <div className="h-full w-full transition-transform duration-700 ease-subtle group-hover:scale-105">
          <Visual
            variant={category.visual}
            image={category.image}
            alt={`${category.name} products`}
          />
        </div>
        <div aria-hidden="true" className="overlay-scrim absolute inset-0" />
      </div>

      {/* z-10 lifts this above the absolute background. It stays
          position:static on purpose so the heading's stretched-link
          pseudo-element resolves against the article and the WHOLE card
          is clickable — z-index applies to static flex items. */}
      <div className="z-10 p-6">
        <h3 className="text-2xl">
          <Link
            to={categoryUrl(category)}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {category.name}
          </Link>
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-cream/70">{category.summary}</p>

        {products.length > 0 && (
          <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-cream/15 pt-4 text-[13px] text-cream/85 sm:grid-cols-2">
            {products.map((product) => (
              <li key={product.id} className="flex items-baseline gap-2">
                <span aria-hidden="true" className="text-cream/40">
                  —
                </span>
                {/* Short catalogue name: the family heading already gives
                    the context that the expanded SEO name would add. */}
                {product.name}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta-400">
          Explore products
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
          />
        </p>
      </div>
    </article>
  )
}
