import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'cream' | 'concrete' | 'charcoal' | 'moss'

const tones: Record<Tone, string> = {
  cream: 'bg-cream text-charcoal',
  concrete: 'bg-cream-200 text-charcoal',
  charcoal: 'bg-charcoal text-cream on-dark',
  moss: 'bg-moss-100 text-charcoal',
}

interface SectionProps {
  id?: string
  tone?: Tone
  className?: string
  children: ReactNode
  /** Renders a top hairline instead of relying on a tone change. */
  divided?: boolean
  as?: 'section' | 'div'
}

export function Section({
  id,
  tone = 'cream',
  className,
  children,
  divided,
  as: Tag = 'section',
}: SectionProps) {
  return (
    <Tag
      id={id}
      className={cn(
        tones[tone],
        divided && 'border-t border-concrete-200',
        'py-14 sm:py-16 lg:py-20',
        className,
      )}
    >
      <div className="shell">{children}</div>
    </Tag>
  )
}

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  /** Right-aligned action, e.g. a "View all" link. */
  action?: ReactNode
  level?: 'h1' | 'h2'
  tone?: 'light' | 'dark'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  action,
  level = 'h2',
  tone = 'light',
  className,
}: SectionHeadingProps) {
  const Heading = level
  return (
    <div className={cn('mb-8 sm:mb-10', className)}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Heading
            className={cn(
              'text-[28px] leading-[1.1] sm:text-[34px] lg:text-[42px]',
              tone === 'dark' ? 'text-cream' : 'text-charcoal',
            )}
          >
            {title}
          </Heading>
          {intro && (
            <div
              className={cn(
                'mt-4 max-w-xl text-[15px] leading-relaxed',
                tone === 'dark' ? 'text-cream/70' : 'text-concrete-700',
              )}
            >
              {intro}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
