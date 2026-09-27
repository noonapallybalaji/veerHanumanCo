import type { CatalogueMatch } from '../../data'
import { cn } from '../../lib/cn'
import { ProductCard } from './ProductCard'
import { ServiceCard } from './ServiceCard'

interface MatchGridProps {
  matches: CatalogueMatch[]
  showCategory?: boolean
  className?: string
  /** Rendered when there is nothing to show. */
  emptyState?: React.ReactNode
}

/**
 * Renders mixed product/service results from any discovery selector.
 * Used by the requirement finder, the application filter and the
 * category pages so results always look and behave identically.
 */
export function MatchGrid({ matches, showCategory = true, className, emptyState }: MatchGridProps) {
  if (matches.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {matches.map((match) => (
        <li key={match.kind === 'product' ? match.product.id : match.service.id} className="flex">
          {match.kind === 'product' ? (
            <ProductCard product={match.product} showCategory={showCategory} className="w-full" />
          ) : (
            <ServiceCard service={match.service} className="w-full" />
          )}
        </li>
      ))}
    </ul>
  )
}
