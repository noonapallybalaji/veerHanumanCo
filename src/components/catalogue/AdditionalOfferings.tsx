import { Link } from 'react-router-dom'
import { confirmedAdditionalOfferings } from '../../data'
import { paths } from '../../lib/paths'

interface AdditionalOfferingsProps {
  type?: 'product' | 'service'
}

/**
 * Renders only offerings whose `status` has been switched to 'confirmed'
 * in data/company.ts. While everything is awaiting owner confirmation this
 * component renders nothing at all, so no unverified offering — and never
 * the internal status itself — reaches a visitor.
 */
export function AdditionalOfferings({ type }: AdditionalOfferingsProps) {
  const offerings = type
    ? confirmedAdditionalOfferings.filter((offering) => offering.type === type)
    : confirmedAdditionalOfferings

  if (offerings.length === 0) return null

  return (
    <section className="border-t border-concrete-200 bg-cream py-12">
      <div className="shell">
        <div className="border border-concrete-200 bg-cream-100 p-6">
          <h2 className="text-lg">Also available</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-concrete-700">
            Alongside the main catalogue, we can quote for the following. Send your requirement for
            availability.
          </p>
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {offerings.map((offering) => (
              <li key={offering.id} className="border-t border-concrete-200 pt-3">
                <p className="text-sm font-semibold text-charcoal">{offering.name}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-concrete-700">
                  {offering.note}
                </p>
              </li>
            ))}
          </ul>
          <Link
            to={paths.requestQuote}
            className="mt-5 inline-flex rounded-sm text-sm font-semibold text-terracotta hover:text-terracotta-700"
          >
            Request a quotation →
          </Link>
        </div>
      </div>
    </section>
  )
}
