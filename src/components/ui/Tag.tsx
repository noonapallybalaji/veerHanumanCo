import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type TagTone = 'neutral' | 'accent' | 'moss' | 'onDark'

const tones: Record<TagTone, string> = {
  neutral: 'border-concrete-300 bg-cream-100 text-concrete-700',
  accent: 'border-terracotta/30 bg-terracotta-100 text-terracotta-700',
  moss: 'border-moss/25 bg-moss-100 text-moss-700',
  onDark: 'border-cream/20 bg-cream/5 text-cream/80',
}

interface TagProps {
  children: React.ReactNode
  tone?: TagTone
  to?: string
  className?: string
}

/** Small pill used for applications and requirement tags. */
export function Tag({ children, tone = 'neutral', to, className }: TagProps) {
  const classes = cn(
    'inline-flex items-center rounded-sm border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.06em]',
    tones[tone],
    to && 'transition-colors hover:border-charcoal/40 hover:text-charcoal',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }
  return <span className={classes}>{children}</span>
}

interface TagListProps {
  label: string
  items: { name: string; slug: string }[]
  tone?: TagTone
  /** Builds the link target for each tag. Omit for non-interactive tags. */
  hrefFor?: (slug: string) => string
  className?: string
}

export function TagList({ label, items, tone = 'neutral', hrefFor, className }: TagListProps) {
  if (items.length === 0) return null
  return (
    <div className={className}>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-concrete">
        {label}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.slug}>
            <Tag tone={tone} to={hrefFor?.(item.slug)}>
              {item.name}
            </Tag>
          </li>
        ))}
      </ul>
    </div>
  )
}
