import { applications, countMatchesByApplication } from '../../data'
import { cn } from '../../lib/cn'
import { getApplicationIcon } from '../visuals/icons'

interface ApplicationFilterProps {
  value: string | null
  onChange: (slug: string | null) => void
  className?: string
}

/** Application chips for /products. Filters on `product.applications`. */
export function ApplicationFilter({ value, onChange, className }: ApplicationFilterProps) {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="group"
      aria-label="Filter the catalogue by application"
    >
      {applications.map((application) => {
        const Icon = getApplicationIcon(application.icon)
        const isSelected = value === application.slug
        const count = countMatchesByApplication(application.slug)

        return (
          <button
            key={application.slug}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(isSelected ? null : application.slug)}
            className={cn(
              'inline-flex min-h-[40px] items-center gap-2 rounded-sm border px-3 py-2 text-[13px] font-medium transition-colors',
              isSelected
                ? 'border-charcoal bg-charcoal text-cream'
                : 'border-concrete-300 bg-cream-100 text-charcoal-600 hover:border-charcoal/40 hover:text-charcoal',
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {application.name}
            <span className={cn('text-[11px]', isSelected ? 'text-cream/60' : 'text-concrete')}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
