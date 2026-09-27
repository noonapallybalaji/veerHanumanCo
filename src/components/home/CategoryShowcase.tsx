import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { productCategories } from '../../data'
import { paths } from '../../lib/paths'
import { CategoryCard } from '../catalogue/CategoryCard'
import { Section, SectionHeading } from '../ui/Section'

export function CategoryShowcase() {
  return (
    <Section id="products" tone="cream">
      <SectionHeading
        eyebrow="Product catalogue"
        title="Products for infrastructure & construction"
        intro="Navigate the catalogue by product family, then send your requirement for availability and quotation."
        action={
          <Link
            to={paths.products}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-charcoal hover:text-terracotta"
          >
            View full catalogue
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {productCategories.map((category) => (
          <li key={category.id} className="flex">
            <CategoryCard category={category} className="w-full" />
          </li>
        ))}
      </ul>
    </Section>
  )
}
