import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activeProducts } from '../../data'
import { paths } from '../../lib/paths'
import { ProductCard } from '../catalogue/ProductCard'
import { Section, SectionHeading } from '../ui/Section'

/** One product from each family, so the breadth is visible without scrolling the whole catalogue. */
const featuredIds = ['prd-rcc-chambers', 'prd-frp-thermodrain', 'prd-pipe-dwc']

export function FeaturedProducts() {
  const featured = featuredIds
    .map((id) => activeProducts.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))

  if (featured.length === 0) return null

  return (
    <Section tone="cream" divided>
      <SectionHeading
        eyebrow="From the catalogue"
        title="Frequently requested products"
        intro="A selection across the three product families. Open any product for applications and enquiry options."
        action={
          <Link
            to={paths.products}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-charcoal hover:text-terracotta"
          >
            All products
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((product) => (
          <li key={product.id} className="flex">
            <ProductCard product={product} className="w-full" />
          </li>
        ))}
      </ul>
    </Section>
  )
}
