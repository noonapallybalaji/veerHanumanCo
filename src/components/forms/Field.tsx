import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface FieldShellProps {
  label: string
  /** Rendered with the generated id/aria wiring passed in. */
  children: (props: {
    id: string
    describedBy: string | undefined
    invalid: boolean
    className: string
  }) => ReactNode
  error?: string
  hint?: string
  required?: boolean
  className?: string
}

const controlClasses =
  'min-h-[48px] w-full rounded-sm border bg-cream-100 px-3.5 py-2.5 text-[15px] text-charcoal placeholder:text-concrete-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream'

/**
 * Wraps a control with its label, hint and error message, and wires up
 * `aria-describedby` / `aria-invalid` so errors are announced rather than
 * only shown in red.
 */
function FieldShell({ label, children, error, hint, required, className }: FieldShellProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={id} className="mb-1.5 text-[13px] font-semibold text-charcoal">
        {label}
        {required ? (
          <span className="ml-1 text-terracotta" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 font-normal text-concrete">(optional)</span>
        )}
      </label>
      {children({
        id,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
        className: cn(
          controlClasses,
          error ? 'border-terracotta bg-terracotta-100/40' : 'border-concrete-300',
        ),
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-concrete">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-terracotta-700">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

interface BaseProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  className?: string
}

export function TextField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required,
  className,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
}: BaseProps & {
  type?: 'text' | 'email' | 'tel' | 'date' | 'number'
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid, className: controlClassName }) => (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClassName}
        />
      )}
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required,
  className,
  rows = 4,
  placeholder,
}: BaseProps & { rows?: number; placeholder?: string }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid, className: controlClassName }) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClassName, 'min-h-[112px] resize-y')}
        />
      )}
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
  /** Options sharing a group are rendered inside one <optgroup>. */
  group?: string
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required,
  className,
  options,
  placeholder = 'Select an option',
}: BaseProps & { options: SelectOption[]; placeholder?: string }) {
  const grouped = options.reduce<Record<string, SelectOption[]>>((acc, option) => {
    const key = option.group ?? ''
    acc[key] = acc[key] ? [...acc[key], option] : [option]
    return acc
  }, {})
  const groupNames = Object.keys(grouped)

  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid, className: controlClassName }) => (
        <select
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClassName, 'appearance-none bg-[length:16px] pr-10')}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238C857D' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          <option value="">{placeholder}</option>
          {groupNames.map((groupName) =>
            groupName ? (
              <optgroup key={groupName} label={groupName}>
                {grouped[groupName].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              grouped[groupName].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            ),
          )}
        </select>
      )}
    </FieldShell>
  )
}
