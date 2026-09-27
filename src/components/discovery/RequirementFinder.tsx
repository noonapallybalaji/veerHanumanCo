import { ArrowRight } from 'lucide-react'
import { countMatchesByRequirementTag, requirementTags } from '../../data'
import { cn } from '../../lib/cn'
import { getRequirementIcon } from '../visuals/icons'

interface RequirementFinderProps {
  /** Selected requirement tag slug, or null for none. */
  value: string | null
  onChange: (slug: string | null) => void
  className?: string
}

/**
 * Requirement tiles. Selecting one filters the catalogue by
 * `product.requirementTags` — there is no per-tile hardcoded product list,
 * so tagging a product is the only change needed to change the results.
 */
export function RequirementFinder({ value, onChange, className }: RequirementFinderProps) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)}
      role="group"
      aria-label="Filter the catalogue by requirement"
    >
      {requirementTags.map((tag) => {
        const Icon = getRequirementIcon(tag.icon)
        const isSelected = value === tag.slug
        const count = countMatchesByRequirementTag(tag.slug)

        return (
          <button
            key={tag.slug}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(isSelected ? null : tag.slug)}
            className={cn(
              'group flex min-h-[132px] flex-col items-start justify-between rounded-sm border p-4 text-left transition-all duration-200 ease-subtle',
              isSelected
                ? 'border-terracotta bg-terracotta text-white shadow-card'
                : 'border-concrete-200 bg-cream-100 text-charcoal hover:border-charcoal/30 hover:shadow-card',
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn('h-5 w-5', isSelected ? 'text-white' : 'text-terracotta')}
            />
            <div className="mt-3">
              <span className="block text-[15px] font-semibold leading-tight">{tag.name}</span>
              <span
                className={cn(
                  'mt-1 block text-[11.5px] leading-snug',
                  isSelected ? 'text-white/80' : 'text-concrete',
                )}
              >
                {count} {count === 1 ? 'item' : 'items'}
              </span>
            </div>
            <span
              className={cn(
                'mt-3 inline-flex items-center gap-1 text-[12px] font-semibold',
                isSelected ? 'text-white' : 'text-charcoal-600',
              )}
            >
              {isSelected ? 'Selected' : 'View'}
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
