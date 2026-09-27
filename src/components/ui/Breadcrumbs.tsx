import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export interface Crumb {
  name: string
  /** Omit on the current page. */
  path?: string
}

interface BreadcrumbsProps {
  items: Crumb[]
  tone?: 'light' | 'dark'
  className?: string
}

export function Breadcrumbs({ items, tone = 'light', className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-[13px]', className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1.5">
              {item.path && !isLast ? (
                <Link
                  to={item.path}
                  className={cn(
                    'rounded-sm underline-offset-4 hover:underline',
                    tone === 'dark' ? 'text-cream/70 hover:text-cream' : 'text-concrete-700 hover:text-charcoal',
                  )}
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn('font-medium', tone === 'dark' ? 'text-cream' : 'text-charcoal')}
                >
                  {item.name}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5', tone === 'dark' ? 'text-cream/40' : 'text-concrete-400')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
