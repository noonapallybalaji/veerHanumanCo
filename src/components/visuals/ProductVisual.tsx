import { useId } from 'react'
import type { VisualVariant } from '../../data/types'
import { cn } from '../../lib/cn'

/**
 * Built-in technical illustrations, one per product.
 *
 * No company photographs were supplied, and generic stock imagery must not
 * be presented as the company's own work. So each product gets a distinct,
 * on-brand technical illustration instead — honest about what it is, fast
 * (inline SVG, no network request) and visually specific to the product.
 *
 * These are a fallback only. The moment a real photograph is set on a
 * product/category/service in the data layer, <Visual> renders the
 * photograph instead and the illustration is never drawn.
 * See public/images/README.md for how to drop photographs in.
 */

interface VisualProps {
  variant: VisualVariant
  /** Photograph path from the data layer. Takes priority when set. */
  image?: string | null
  /**
   * The subject shown, e.g. "RCC Chambers" — not a full sentence.
   * A photograph is described as itself; the illustration fallback is
   * announced as an illustration, so it is never mistaken for a site
   * photograph. Pass "" for purely decorative use.
   */
  alt: string
  className?: string
  /** Dark treatment, for use on charcoal sections. */
  tone?: 'light' | 'dark'
  /** Native lazy loading for photographs. */
  loading?: 'lazy' | 'eager'
}

export function Visual({
  variant,
  image,
  alt,
  className,
  tone = 'light',
  loading = 'lazy',
}: VisualProps) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt}
        loading={loading}
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }
  return (
    <ProductVisual
      variant={variant}
      alt={alt ? `Technical illustration of ${alt}` : ''}
      className={className}
      tone={tone}
    />
  )
}

interface ProductVisualProps {
  variant: VisualVariant
  alt: string
  className?: string
  tone?: 'light' | 'dark'
}

export function ProductVisual({
  variant,
  alt,
  className,
  tone = 'light',
}: ProductVisualProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gridId = `grid-${uid}`
  const skyId = `sky-${uid}`

  const palette =
    tone === 'dark'
      ? {
          bgFrom: '#26221F',
          bgTo: '#141211',
          grid: '#FAF6F0',
          gridOpacity: 0.05,
          line: '#EAE2D6',
          fill: '#332E29',
          fillAlt: '#4A443D',
          accent: '#D46A4E',
          green: '#628E6D',
        }
      : {
          bgFrom: '#EDE6DB',
          bgTo: '#CFC7BC',
          grid: '#1B1917',
          gridOpacity: 0.05,
          line: '#4A443D',
          fill: '#D8D1C6',
          fillAlt: '#BDB5A9',
          accent: '#C0472B',
          green: '#3F6B4A',
        }

  const isDecorative = alt.trim().length === 0

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
      role={isDecorative ? undefined : 'img'}
      aria-label={isDecorative ? undefined : alt}
      aria-hidden={isDecorative || undefined}
      focusable="false"
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={palette.bgFrom} />
          <stop offset="100%" stopColor={palette.bgTo} />
        </linearGradient>
        <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M20 0H0V20"
            fill="none"
            stroke={palette.grid}
            strokeOpacity={palette.gridOpacity}
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="400" height="300" fill={`url(#${skyId})`} />
      <rect width="400" height="300" fill={`url(#${gridId})`} />

      <g
        stroke={palette.line}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {renderVariant(variant, palette)}
      </g>
    </svg>
  )
}

type Palette = {
  line: string
  fill: string
  fillAlt: string
  accent: string
  green: string
}

function renderVariant(variant: VisualVariant, p: Palette) {
  switch (variant) {
    /* ---------------------------------------------------------- RCC --- */
    case 'rcc-chamber':
      // Stacked precast chamber rings, one open ring in front.
      return (
        <>
          <ellipse cx="120" cy="218" rx="62" ry="22" fill={p.fillAlt} />
          <path d="M58 218v-44M182 218v-44" />
          <ellipse cx="120" cy="174" rx="62" ry="22" fill={p.fill} />
          <ellipse cx="120" cy="174" rx="44" ry="14" fill={p.fillAlt} />
          <path d="M58 174v-40M182 174v-40" />
          <ellipse cx="120" cy="134" rx="62" ry="22" fill={p.fill} />
          <ellipse cx="120" cy="134" rx="44" ry="14" fill={p.fillAlt} />
          <ellipse cx="288" cy="232" rx="52" ry="18" fill={p.fillAlt} />
          <path d="M236 232v-36M340 232v-36" />
          <ellipse cx="288" cy="196" rx="52" ry="18" fill={p.fill} />
          <ellipse cx="288" cy="196" rx="36" ry="11" fill={p.fillAlt} />
          <path d="M120 112v-24" stroke={p.accent} strokeDasharray="6 5" />
          <path d="M104 92h32" stroke={p.accent} />
        </>
      )

    case 'rcc-manhole-cover':
      // Circular cover lifted clear of its square frame.
      return (
        <>
          <path d="M112 236h176l-34-52H146z" fill={p.fillAlt} />
          <path d="M146 184h108l34 52H112z" />
          <path d="M168 210h64" strokeOpacity="0.5" />
          <circle cx="200" cy="124" r="74" fill={p.fill} />
          <circle cx="200" cy="124" r="58" fill={p.fillAlt} />
          <circle cx="200" cy="124" r="40" />
          <path d="M160 124h80M200 84v80M172 96l56 56M228 96l-56 56" strokeOpacity="0.45" />
          <circle cx="200" cy="124" r="10" fill={p.accent} stroke="none" />
          <path d="M126 124a74 74 0 0 1 14-43" stroke={p.accent} strokeWidth="3" />
        </>
      )

    case 'rcc-pole':
      // Tapered precast poles resting on a stack.
      return (
        <>
          <path d="M40 252h320" strokeOpacity="0.45" />
          <path d="M52 236l286-96 10 24-286 96z" fill={p.fill} />
          <path d="M96 220l286-96" strokeOpacity="0" />
          <path d="M40 210l296-100 8 20-296 100z" fill={p.fillAlt} />
          <path d="M60 178l276-94 6 16-276 94z" fill={p.fill} />
          <path d="M150 178l-6-16M220 154l-6-16M290 130l-6-16" strokeOpacity="0.4" />
          <path d="M336 84l6 16" stroke={p.accent} strokeWidth="3" />
          <path d="M52 236l-12 16" strokeOpacity="0.35" />
        </>
      )

    case 'rcc-tree-guard':
      // Cylindrical guard with vertical bars protecting a sapling.
      return (
        <>
          <ellipse cx="200" cy="244" rx="96" ry="20" fill={p.fillAlt} strokeOpacity="0.5" />
          <path
            d="M200 232c0-26-4-44-16-60 14 6 22 14 28 26 4-22 12-36 26-46-8 20-10 36-6 52"
            fill={p.green}
            stroke={p.green}
          />
          <path d="M200 236v-46" stroke={p.green} strokeWidth="4" />
          <ellipse cx="200" cy="238" rx="56" ry="14" fill="none" />
          <ellipse cx="200" cy="170" rx="56" ry="14" fill="none" />
          <ellipse cx="200" cy="120" rx="56" ry="14" fill="none" />
          <path d="M144 238v-118M256 238v-118M172 244v-130M228 244v-130M200 246v-132" />
          <path d="M256 120a56 14 0 0 1-56 14" stroke={p.accent} strokeWidth="3" />
        </>
      )

    /* ---------------------------------------------------------- FRP --- */
    case 'frp-frame-cover':
      // Square frame with a matching cover set beside it.
      return (
        <>
          <path d="M44 210l98-56 98 56-98 56z" fill={p.fillAlt} />
          <path d="M78 210l64-36 64 36-64 36z" fill={p.fill} />
          <path d="M96 210l46-26 46 26-46 26z" strokeOpacity="0.45" fill="none" />
          <path d="M228 140l70-40 70 40-70 40z" fill={p.fill} />
          <path d="M228 140v18l70 40 70-40v-18" fill={p.fillAlt} />
          <path d="M254 140l44-26M342 140l-44-26" strokeOpacity="0.4" />
          <circle cx="262" cy="120" r="4" fill={p.accent} stroke="none" />
          <circle cx="334" cy="120" r="4" fill={p.accent} stroke="none" />
          <circle cx="298" cy="160" r="4" fill={p.accent} stroke="none" />
        </>
      )

    case 'frp-thermodrain':
      // Linear channel drain running across the frame, slotted grating.
      return (
        <>
          <path d="M24 196l120-70h232l-120 70z" fill={p.fillAlt} />
          <path d="M24 196v30l232 0v-30" fill={p.fill} />
          <path d="M256 226l120-70v-30l-120 70z" fill={p.fillAlt} />
          <path d="M64 178l120-70M104 178l120-70M144 178l120-70M184 178l120-70M224 178l120-70" />
          <path d="M44 214h192" strokeOpacity="0.4" />
          <path d="M24 226l-10 14M256 226l-10 14" strokeOpacity="0.3" />
          <path d="M300 118l24-14" stroke={p.accent} strokeWidth="3" />
        </>
      )

    case 'frp-gully':
      // Gully grating viewed from above, seated in its frame.
      return (
        <>
          <rect x="88" y="58" width="224" height="184" rx="3" fill={p.fillAlt} />
          <rect x="112" y="82" width="176" height="136" rx="2" fill={p.fill} />
          <path d="M132 82v136M160 82v136M188 82v136M216 82v136M244 82v136M268 82v136" />
          <path d="M112 130h176M112 170h176" strokeOpacity="0.4" />
          <path d="M88 58h44M268 242h44" stroke={p.accent} strokeWidth="3" />
          <path
            d="M200 262c14-10 22-20 22-28"
            stroke={p.accent}
            strokeWidth="2"
            strokeDasharray="5 5"
          />
        </>
      )

    /* -------------------------------------------------------- Pipes --- */
    case 'pipe-hdpe':
      // HDPE supplied in coils — concentric coil plus a cut end.
      return (
        <>
          <circle cx="156" cy="158" r="94" fill={p.fillAlt} />
          <circle cx="156" cy="158" r="94" />
          <circle cx="156" cy="158" r="74" fill={p.fill} />
          <circle cx="156" cy="158" r="56" fill={p.fillAlt} />
          <circle cx="156" cy="158" r="38" fill={p.fill} />
          <circle cx="156" cy="158" r="20" fill={p.fillAlt} />
          <path d="M250 158h22" strokeOpacity="0.4" />
          <ellipse cx="322" cy="192" rx="18" ry="34" fill={p.fill} />
          <ellipse cx="322" cy="192" rx="9" ry="20" fill={p.fillAlt} />
          <path d="M272 158c22 0 32 12 34 24" />
          <path d="M156 64v-18" stroke={p.accent} strokeWidth="3" />
          <path d="M138 46h36" stroke={p.accent} strokeWidth="3" />
        </>
      )

    case 'pipe-ecodrain':
      // Perforated drainage pipe collecting water from the soil above.
      return (
        <>
          <path d="M40 120h320" strokeDasharray="4 8" strokeOpacity="0.4" />
          <path d="M96 96v16M160 88v24M232 96v16M296 88v24" stroke={p.green} strokeWidth="3" />
          <ellipse cx="72" cy="196" rx="20" ry="42" fill={p.fill} />
          <path d="M72 154h240" strokeOpacity="0" />
          <path d="M72 154h240M72 238h240" />
          <ellipse cx="312" cy="196" rx="20" ry="42" fill={p.fillAlt} />
          <ellipse cx="312" cy="196" rx="10" ry="24" fill={p.fill} />
          <path
            d="M120 166h18M170 166h18M220 166h18M270 166h18M120 226h18M170 226h18M220 226h18M270 226h18"
            strokeOpacity="0.55"
          />
          <circle cx="132" cy="140" r="5" fill={p.green} stroke="none" />
          <circle cx="204" cy="146" r="4" fill={p.green} stroke="none" />
          <circle cx="268" cy="140" r="5" fill={p.green} stroke="none" />
          <path d="M40 260h320" stroke={p.accent} strokeWidth="3" strokeOpacity="0.8" />
        </>
      )

    case 'pipe-dwc':
      // Double wall corrugated: corrugated outside, smooth bore at the cut end.
      return (
        <>
          <path d="M92 156h226M92 240h226" />
          <path
            d="M112 156v84M140 156v84M168 156v84M196 156v84M224 156v84M252 156v84M280 156v84"
            strokeOpacity="0.45"
          />
          <path d="M92 156h226v84H92z" fill={p.fillAlt} fillOpacity="0.55" stroke="none" />
          <ellipse cx="92" cy="198" rx="22" ry="46" fill={p.fill} />
          <ellipse cx="92" cy="198" rx="12" ry="30" fill={p.fillAlt} />
          <ellipse cx="318" cy="198" rx="22" ry="46" fill={p.fillAlt} fillOpacity="0.5" />
          <path d="M92 152v-30" stroke={p.accent} strokeDasharray="6 5" />
          <path d="M72 122h40" stroke={p.accent} strokeWidth="3" />
          <path d="M40 262h320" strokeOpacity="0.35" />
        </>
      )

    /* -------------------------------------------------- Contextual --- */
    case 'landscaping':
      // Planted area with paving and a guarded sapling.
      return (
        <>
          <path
            d="M0 210c60-22 110-16 160 2s120 18 240-10v98H0z"
            fill={p.green}
            fillOpacity="0.55"
            stroke="none"
          />
          <path d="M0 210c60-22 110-16 160 2s120 18 240-10" stroke={p.green} />
          <path d="M84 214v-34" stroke={p.line} strokeWidth="3" />
          <path
            d="M84 184c-16-8-24-22-22-40 18 2 30 12 34 28 6-18 18-28 36-30-2 20-14 34-32 40"
            fill={p.green}
            stroke={p.green}
          />
          <path d="M272 220v-28" stroke={p.line} strokeWidth="3" />
          <path
            d="M272 192c-12-6-18-16-16-30 14 2 22 10 26 22 4-14 14-22 26-24-2 16-10 26-24 30"
            fill={p.green}
            stroke={p.green}
          />
          <ellipse cx="272" cy="226" rx="26" ry="8" fill="none" strokeOpacity="0.5" />
          <path d="M256 226v-22M288 226v-22" strokeOpacity="0.5" />
          <path d="M0 262h400" strokeOpacity="0.3" />
          <path d="M60 282h100M180 282h100" stroke={p.accent} strokeOpacity="0.7" />
        </>
      )

    case 'infrastructure':
    default:
      /* Trench section through a road: surfacing, open trench, a pipe
         bedded in the invert, and a chamber standing on the surface.
         Drawn as a clear cross-section — it is the widest-used variant
         (hero, projects, about), so legibility matters most here. */
      return (
        <>
          {/* Road surfacing */}
          <path d="M0 104h400v24H0z" fill={p.fillAlt} stroke="none" />
          <path d="M0 104h130M270 104h130" strokeWidth="2.5" />
          <path d="M0 128h130M270 128h130" strokeOpacity="0.55" />

          {/* Sub-grade hatching either side of the trench */}
          <path
            d="M0 140h110M0 162h110M0 184h110M290 140h110M290 162h110M290 184h110"
            strokeOpacity="0.22"
          />

          {/* Open trench */}
          <path d="M130 104v40M270 104v40" strokeWidth="2.5" />
          <path d="M130 144v92M270 144v92" strokeDasharray="7 6" strokeOpacity="0.7" />
          <path d="M112 236h176" strokeWidth="3" />

          {/* Pipe in section, bedded in the invert */}
          <circle cx="200" cy="188" r="48" fill={p.fill} />
          <circle cx="200" cy="188" r="31" fill={p.fillAlt} />
          <circle cx="200" cy="188" r="48" />
          <circle cx="200" cy="188" r="31" strokeOpacity="0.6" />

          {/* Centreline callout */}
          <path d="M200 132v-20" stroke={p.accent} strokeDasharray="5 4" />
          <path d="M182 112h36" stroke={p.accent} strokeWidth="2.5" />

          {/* Chamber standing on the surface, ready to be set */}
          <ellipse cx="330" cy="86" rx="36" ry="12" fill={p.fillAlt} />
          <path d="M294 86V60M366 86V60" />
          <ellipse cx="330" cy="60" rx="36" ry="12" fill={p.fill} />
          <ellipse cx="330" cy="60" rx="23" ry="7" fill={p.fillAlt} />

          {/* Pipe run continuing out of frame */}
          <path d="M112 188H28" strokeDasharray="11 8" strokeOpacity="0.45" />
          <path d="M288 188h84" strokeDasharray="11 8" strokeOpacity="0.45" />
        </>
      )
  }
}
