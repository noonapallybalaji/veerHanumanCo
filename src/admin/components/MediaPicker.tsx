import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, api, assetUrl } from '../../lib/api'
import { AdminButton, LoadingState, inputClass, useToast } from './ui'

export interface MediaItem {
  id: string
  url: string
  kind: string
  filename: string
  width: number | null
  height: number | null
  size: number
  alt: string | null
}

/**
 * Choose an existing image or upload a new one.
 *
 * The server validates type and size and re-encodes images, so this only
 * needs to give honest feedback. Alt text is captured at upload time
 * because retro-fitting it never happens.
 */
export function MediaPicker({
  value,
  onChange,
  label = 'Image',
  hint,
}: {
  value: string | null
  onChange: (mediaId: string | null) => void
  label?: string
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [alt, setAlt] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { push } = useToast()

  const selected = items?.find((item) => item.id === value) ?? null

  async function load() {
    try {
      const response = await api.get<{ media: MediaItem[] }>('/api/admin/media?kind=IMAGE')
      setItems(response.media)
    } catch (error) {
      push('error', (error as Error).message)
      setItems([])
    }
  }

  useEffect(() => {
    // Load once so the current selection can be previewed.
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpload(file: File) {
    if (!alt.trim()) {
      push('error', 'Add a short description of the image before uploading.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', 'IMAGE')
      form.append('alt', alt.trim())
      const response = await api.upload<{ media: MediaItem }>('/api/admin/media/upload', form)
      push('success', 'Image uploaded.')
      setAlt('')
      await load()
      onChange(response.media.id)
      setOpen(false)
    } catch (error) {
      push(
        'error',
        error instanceof ApiRequestError ? error.message : 'The upload did not complete.',
      )
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-semibold text-charcoal">
        {label}
        {hint && <span className="font-normal text-concrete">{hint}</span>}
      </span>

      <div className="flex items-start gap-3">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden border border-concrete-300 bg-cream">
          {value ? (
            <img
              src={assetUrl(selected?.url ?? `/api/media/${value}`) ?? ''}
              alt={selected?.alt ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[11.5px] leading-snug text-concrete">
              Using the built-in illustration
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminButton size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <ImagePlus aria-hidden="true" className="h-3.5 w-3.5" />
            {value ? 'Change' : 'Choose or upload'}
          </AdminButton>
          {value && (
            <AdminButton size="sm" variant="ghost" onClick={() => onChange(null)}>
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Remove
            </AdminButton>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-charcoal/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose an image"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col border border-concrete-300 bg-cream-100"
          >
            <header className="flex items-center justify-between border-b border-concrete-200 px-5 py-3">
              <h2 className="text-base">Choose an image</h2>
              <AdminButton size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </AdminButton>
            </header>

            <div className="border-b border-concrete-200 bg-cream-200 px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[240px] flex-1">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-charcoal">
                    Describe the image (alt text)
                  </span>
                  <input
                    value={alt}
                    onChange={(event) => setAlt(event.target.value)}
                    placeholder="e.g. RCC chamber rings stacked at the yard"
                    className={inputClass}
                  />
                </label>
                <AdminButton
                  variant="secondary"
                  busy={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  Upload new
                </AdminButton>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleUpload(file)
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] text-concrete">
                JPG, PNG, WebP or AVIF. Large photos are resized and converted to WebP
                automatically.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!items && <LoadingState label="Loading images" />}
              {items && items.length === 0 && (
                <p className="py-8 text-center text-sm text-concrete-700">
                  No images uploaded yet. Products fall back to their built-in illustration until
                  you add one.
                </p>
              )}
              {items && items.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(item.id)
                          setOpen(false)
                        }}
                        className={`block w-full overflow-hidden border text-left transition-colors ${
                          value === item.id
                            ? 'border-terracotta ring-2 ring-terracotta/30'
                            : 'border-concrete-300 hover:border-charcoal/40'
                        }`}
                      >
                        <span className="block aspect-[4/3] bg-cream">
                          <img
                            src={assetUrl(item.url) ?? ''}
                            alt={item.alt ?? ''}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="block truncate px-2 py-1.5 text-[11.5px] text-concrete-700">
                          {item.filename}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
