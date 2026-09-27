import { useEffect, type RefObject } from 'react'

/**
 * Keeps keyboard focus inside an open dialog.
 *
 * Without this, Tab walks straight out of a modal and into the page behind
 * it: a keyboard or screen-reader user ends up operating controls they
 * cannot see, with no way back. WCAG 2.4.3 / 2.1.2.
 *
 * On open it moves focus into the dialog; on close it returns focus to
 * whatever was focused before, so the tab position is not lost.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: {
    autoFocus?: boolean
    /** Focus this instead of the first tabbable element (e.g. the name field). */
    initialFocus?: RefObject<HTMLElement | null>
  } = {},
) {
  const { autoFocus = true, initialFocus } = options

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const cleanups: (() => void)[] = []

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        // offsetParent is null for display:none; also skip aria-hidden.
        (element) => element.offsetParent !== null || element === document.activeElement,
      )

    if (autoFocus) {
      // The ref may not be attached yet on the first paint, hence the frame.
      const frame = requestAnimationFrame(() => {
        const preferred = initialFocus?.current
        const first = preferred ?? focusable()[0]
        // Fall back to the container so focus at least enters the dialog.
        if (first) first.focus()
        else {
          container.setAttribute('tabindex', '-1')
          container.focus()
        }
      })
      cleanups.push(() => cancelAnimationFrame(frame))
    }

    // An arrow const, not a hoisted declaration: TS only narrows `container`
    // to non-null for closures created after the guard above.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const current = document.activeElement

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault()
          last.focus()
        }
      } else if (current === last || !container.contains(current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)


    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      for (const cleanup of cleanups) cleanup()

      // Only reclaim focus if it is still inside this dialog. If a nested
      // dialog opened on top (welcome modal → OTP dialog) focus now belongs
      // to that one, and yanking it back would strand the keyboard user.
      if (!container.contains(document.activeElement)) return
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [ref, active, autoFocus, initialFocus])
}
