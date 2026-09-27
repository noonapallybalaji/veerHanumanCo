import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'

interface PageHeaderProps {
  crumbs: Crumb[]
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  /** CTA group, rendered under the intro. */
  actions?: ReactNode
  /** Panel shown alongside the heading on wide screens. */
  aside?: ReactNode
  tone?: 'charcoal' | 'cream'
  className?: string
}

/** Consistent page header for every inner page: breadcrumbs + H1 + intro. */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  intro,
  actions,
  aside,
  tone = 'charcoal',
  className,
}: PageHeaderProps) {
  const dark = tone === 'charcoal'

  return (
    <section
      className={cn(
        dark
          ? 'bg-charcoal text-cream on-dark'
          : 'border-b border-concrete-200 bg-cream-200 text-charcoal',
        className,
      )}
    >
      <div className="shell py-10 lg:py-14">
        <Breadcrumbs items={crumbs} tone={dark ? 'dark' : 'light'} className="mb-6" />

        <div className={cn('grid gap-8', aside ? 'lg:grid-cols-[1.4fr_1fr] lg:items-end' : null)}>
          <div>
            {eyebrow && (
              <p
                className={cn(
                  'eyebrow mb-4',
                  dark && 'text-terracotta-400 before:bg-terracotta-400/60',
                )}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="max-w-2xl text-[30px] leading-[1.08] sm:text-[38px] lg:text-[46px]">
              {title}
            </h1>
            {intro && (
              <div
                className={cn(
                  'mt-5 max-w-xl text-[15px] leading-relaxed',
                  dark ? 'text-cream/70' : 'text-concrete-700',
                )}
              >
                {intro}
              </div>
            )}
            {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
          </div>
          {aside && <div>{aside}</div>}
        </div>
      </div>
    </section>
  )
}
