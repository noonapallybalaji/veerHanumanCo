import { ArrowRight, Boxes, FileText, Layers } from 'lucide-react'
import { activeProducts, productCategories } from '../../data'
import { generalEnquiryMessage } from '../../lib/contact'
import { paths } from '../../lib/paths'
import { Button } from '../ui/Button'
import { WhatsAppButton } from '../ui/WhatsAppButton'
import { ProductVisual } from '../visuals/ProductVisual'

/**
 * Hero.
 *
 * Typography is deliberately restrained rather than an oversized marketing
 * headline — the job is to tell a contractor what is supplied within a
 * couple of seconds, then get them into the catalogue.
 *
 * The artwork sits in its own framed panel instead of washing behind the
 * text. A full-bleed illustration under a dark gradient read as muddy
 * banding and made the headline harder to scan.
 */
export function Hero() {
  const strip = [
    {
      icon: Layers,
      title: 'Product catalogue',
      detail: `${productCategories.map((c) => c.shortName ?? c.name).join(', ')} and related products`,
    },
    {
      icon: Boxes,
      title: 'Project quantities',
      detail: 'Enquiries for project and bulk requirements welcome',
    },
    {
      icon: FileText,
      title: 'Requirement-based quotes',
      detail: 'Share sizes and quantities, receive a quotation',
    },
  ]

  return (
    <section className="relative isolate overflow-hidden bg-charcoal text-cream on-dark">
      {/* Blueprint texture — decorative, very low contrast. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #FAF6F0 1px, transparent 1px), linear-gradient(to bottom, #FAF6F0 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-terracotta/10 to-transparent"
      />

      <div className="shell relative py-14 sm:py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow mb-5 text-terracotta-400 before:bg-terracotta-400/60">
              Infrastructure supply · Drainage · Landscaping
            </p>

            <h1 className="max-w-2xl text-[34px] leading-[1.06] sm:text-[42px] lg:text-[52px]">
              Reliable infrastructure products.
              <span className="block text-cream/55">Built for every project.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-cream/70 sm:text-base">
              RCC, FRP, drainage and piping solutions for construction, infrastructure and
              landscaping projects across Hyderabad and Telangana.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button to={paths.products} variant="accent" size="lg">
                Explore products
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Button to={paths.requestQuote} variant="onDark" size="lg">
                Get a Quote
              </Button>
              <WhatsAppButton message={generalEnquiryMessage()} size="lg" tone="onDark" />
            </div>

            <p className="mt-6 text-[13px] text-cream/45">
              {activeProducts.length} products across {productCategories.length} product families ·
              Hyderabad, Telangana
            </p>
          </div>

          {/* Decorative on mobile, so it is simply not loaded there. */}
          <div className="hidden lg:block">
            <div className="overflow-hidden border border-cream/15 bg-charcoal-800">
              <div className="aspect-[4/3] w-full">
                <ProductVisual variant="infrastructure" alt="" tone="dark" />
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-cream/15 bg-cream/15 sm:grid-cols-3 lg:mt-16">
          {strip.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="bg-charcoal p-5">
                <Icon aria-hidden="true" className="h-4 w-4 text-terracotta-400" />
                <dt className="mt-2.5 text-sm font-semibold text-cream">{item.title}</dt>
                <dd className="mt-1 text-[12.5px] leading-snug text-cream/55">{item.detail}</dd>
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
