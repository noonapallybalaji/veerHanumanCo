import { Link } from 'react-router-dom'
import { companyConfig } from '../../data/company'
import { cn } from '../../lib/cn'
import { paths } from '../../lib/paths'

interface LogoProps {
  tone?: 'light' | 'dark'
  className?: string
}

/** Wordmark: terracotta "VH" block plus the company name in two lines. */
export function Logo({ tone = 'light', className }: LogoProps) {
  return (
    <Link
      to={paths.home}
      className={cn('group flex shrink-0 items-center gap-2.5 rounded-sm', className)}
      aria-label={`${companyConfig.companyName} — home`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta font-display text-[15px] font-extrabold tracking-tight text-white"
      >
        VH
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[15px] font-extrabold uppercase leading-none tracking-[0.02em] sm:text-base',
            tone === 'dark' ? 'text-cream' : 'text-charcoal',
          )}
        >
          Veer Hanuman
        </span>
        <span
          className={cn(
            'mt-1 text-[9.5px] font-semibold uppercase tracking-[0.26em]',
            tone === 'dark' ? 'text-cream/55' : 'text-concrete',
          )}
        >
          Trading Co.
        </span>
      </span>
    </Link>
  )
}
