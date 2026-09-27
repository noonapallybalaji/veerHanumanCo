import { Boxes, HardHat, Layers, MessageSquare, Ruler, Truck } from 'lucide-react'
import { companyConfig } from '../../data/company'
import { Section, SectionHeading } from '../ui/Section'

/**
 * Practical B2B value propositions only.
 *
 * No numerical claims ("500+ projects", "10,000+ customers") and no
 * certifications or awards — none were supplied, and inventing them would
 * be exactly the kind of thing a procurement team checks.
 */
const points = [
  {
    icon: Layers,
    title: 'Multi-category supply',
    detail:
      'RCC, FRP frame and cover assemblies and piping from a single point of contact, so one enquiry can cover several line items.',
  },
  {
    icon: Boxes,
    title: 'Bulk requirements',
    detail:
      'Enquiries for project quantities are welcome alongside smaller individual material requirements.',
  },
  {
    icon: Ruler,
    title: 'Requirement-based quotations',
    detail:
      'Quotations are prepared against the sizes, quantities and site conditions you share, not against a fixed price list.',
  },
  {
    icon: HardHat,
    title: 'Product sourcing',
    detail:
      'Where a requirement sits outside the standard catalogue, tell us the specification and we will confirm what can be arranged.',
  },
  {
    icon: Truck,
    title: 'Project coordination',
    detail:
      'Delivery location and requirement dates are reviewed with each enquiry so supply can be planned around your site programme.',
  },
  {
    icon: MessageSquare,
    title: 'Direct communication',
    detail:
      'You deal directly with the team handling the enquiry, by form, phone or WhatsApp.',
  },
]

export function WhyUsSection() {
  return (
    <Section id="why-us" tone="charcoal">
      <SectionHeading
        eyebrow="Why Veer Hanuman"
        title="Built around your project requirements"
        intro={
          <>
            From individual material requirements to larger project quantities, we help customers
            source the products they need through a direct and practical enquiry process. Operating
            from {companyConfig.address.city} since {companyConfig.establishedYear}.
          </>
        }
        tone="dark"
      />

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-cream/15 bg-cream/15 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => {
          const Icon = point.icon
          return (
            <li key={point.title} className="bg-charcoal p-6">
              <Icon aria-hidden="true" className="h-5 w-5 text-terracotta-400" />
              <h3 className="mt-4 text-base text-cream">{point.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-cream/60">{point.detail}</p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
