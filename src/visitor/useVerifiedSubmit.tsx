import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { OtpDialog } from './OtpDialog'
import { useVisitor } from './VisitorContext'

/**
 * Gates a form submission behind phone verification.
 *
 * How the "don't lose what I typed" requirement is met: the caller's form
 * stays mounted throughout. This hook only renders an overlay and holds the
 * pending submit callback, so no state is unmounted, no navigation happens,
 * and the submission runs afterwards with the same values.
 *
 * Order of operations matters — the enquiry is only POSTed *after* the
 * server has confirmed verification and issued a session, never optimistically.
 */
export function useVerifiedSubmit() {
  const { visitor, capability } = useVisitor()
  const [pending, setPending] = useState<{
    phone: string
    profile: { name?: string; email?: string; company?: string }
    run: () => void | Promise<void>
  } | null>(null)

  const otpAvailable = capability?.otpAvailable ?? false

  /** True when this browser already holds a verified session for `phone`. */
  const isVerifiedFor = useCallback(
    (phone: string) => {
      if (!visitor?.phoneVerified) return false
      const digits = (value: string) => value.replace(/[^\d]/g, '').slice(-10)
      return digits(visitor.phone) === digits(phone)
    },
    [visitor],
  )

  /**
   * Runs `submit` immediately when the number is already verified, otherwise
   * opens verification first and runs it on success.
   */
  const submitVerified = useCallback(
    (args: {
      phone: string
      profile?: { name?: string; email?: string; company?: string }
      submit: () => void | Promise<void>
    }) => {
      if (isVerifiedFor(args.phone)) {
        void args.submit()
        return
      }
      setPending({ phone: args.phone, profile: args.profile ?? {}, run: args.submit })
    },
    [isVerifiedFor],
  )

  /*
   * Portalled to <body> deliberately.
   *
   * Callers render this from inside their <form>, and the dialog contains a
   * form of its own. Nested forms are invalid HTML: the inner submit button
   * binds to the OUTER form, so clicking "Verify" also submitted the
   * enquiry form and wiped everything the visitor had typed. Portalling
   * moves the dialog out of that DOM subtree while keeping it in the React
   * tree, so the caller's state stays mounted and intact.
   */
  const dialog =
    pending && typeof document !== 'undefined'
      ? createPortal(
          <OtpDialog
            phone={pending.phone}
            purpose="ENQUIRY"
            profile={pending.profile}
            title="Verify your number to send this"
            description="We verify every enquiry so we can be sure we are quoting a real requirement. Enter the code we just sent by SMS."
            onCancel={() => setPending(null)}
            onVerified={() => {
              const run = pending.run
              setPending(null)
              // Only now, with a server-issued session, does the enquiry go.
              void run()
            }}
          />,
          document.body,
        )
      : null

  return { submitVerified, isVerifiedFor, otpAvailable, verificationDialog: dialog, visitor }
}
