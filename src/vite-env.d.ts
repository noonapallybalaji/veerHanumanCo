/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional endpoint that accepts a JSON POST of the enquiry payload.
   * Leave unset and the forms fall back to a WhatsApp/copy handoff
   * instead of claiming an email was sent. See src/lib/enquiry.ts.
   */
  readonly VITE_ENQUIRY_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
