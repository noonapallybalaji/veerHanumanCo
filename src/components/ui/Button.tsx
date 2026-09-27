import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'whatsapp' | 'onDark'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors duration-200 ease-subtle disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-charcoal text-cream hover:bg-charcoal-700',
  accent: 'bg-terracotta text-white hover:bg-terracotta-600',
  outline:
    'border border-charcoal/25 bg-transparent text-charcoal hover:border-charcoal hover:bg-charcoal hover:text-cream',
  ghost: 'text-charcoal hover:bg-charcoal/5',
  // WhatsApp green is used ONLY for WhatsApp actions.
  whatsapp: 'bg-whatsapp text-white hover:bg-whatsapp-dark',
  onDark: 'border border-cream/30 bg-transparent text-cream hover:bg-cream hover:text-charcoal',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-[40px] px-3.5 text-[13px]',
  md: 'min-h-[44px] px-5 text-sm',
  lg: 'min-h-[52px] px-6 text-[15px]',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  /** Full width on mobile is the default for stacked CTA groups. */
  block?: boolean
}

type ButtonProps = CommonProps & {
  to?: undefined
  href?: undefined
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
}

type LinkProps = CommonProps & {
  to: string
  href?: undefined
  'aria-label'?: string
  onClick?: () => void
}

type AnchorProps = CommonProps & {
  href: string
  to?: undefined
  /** External links open in a new tab by default. */
  newTab?: boolean
  'aria-label'?: string
  onClick?: () => void
}

export function Button(props: ButtonProps | LinkProps | AnchorProps) {
  const { variant = 'primary', size = 'md', className, children, block } = props
  const classes = cn(base, variants[variant], sizes[size], block && 'w-full', className)

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes} aria-label={props['aria-label']} onClick={props.onClick}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href) {
    const external = /^https?:/.test(props.href)
    const newTab = props.newTab ?? external
    return (
      <a
        href={props.href}
        className={classes}
        aria-label={props['aria-label']}
        onClick={props.onClick}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  const { type = 'button', onClick, disabled } = props as ButtonProps
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      aria-label={props['aria-label']}
    >
      {children}
    </button>
  )
}
