import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Service } from '../../data/types'
import { cn } from '../../lib/cn'
import { serviceUrl } from '../../lib/paths'
import { Visual } from '../visuals/ProductVisual'

interface ServiceCardProps {
  service: Service
  className?: string
}

export function ServiceCard({ service, className }: ServiceCardProps) {
  return (
    <article
      className={cn(
        'group relative flex flex-col border border-moss/20 bg-moss-100 transition-shadow duration-300 ease-subtle hover:shadow-card focus-within:shadow-card',
        className,
      )}
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-moss/20">
        <div className="h-full w-full transition-transform duration-500 ease-subtle group-hover:scale-[1.03]">
          <Visual variant={service.visual} image={service.image} alt={service.name} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-moss-700">
          Service
        </p>
        <h3 className="text-lg leading-snug">
          <Link
            to={serviceUrl(service)}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {service.name}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-concrete-700">{service.summary}</p>
        <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-moss-700">
          View service
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </p>
      </div>
    </article>
  )
}
