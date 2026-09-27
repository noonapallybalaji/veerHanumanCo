import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { getProductsByCategory, productCategories, productDisplayName } from '../data'
import { categoryUrl, paths, productUrl } from '../lib/paths'
import { Seo } from '../lib/seo'

export default function NotFound() {
  return (
    <>
      <Seo
        title="Page not found"
        description="The page you were looking for could not be found. Browse the Veer Hanuman Trading Co. product catalogue instead."
        path="/404"
        noIndex
      />

      <Section tone="cream" className="min-h-[60vh]">
        <p className="eyebrow mb-4">Error 404</p>
        <h1 className="max-w-xl text-[30px] leading-[1.08] sm:text-[38px]">
          We could not find that page
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-concrete-700">
          The link may be out of date. The full product catalogue is below, or send your requirement
          and we will point you to the right product.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button to={paths.products} variant="accent" size="lg">
            Explore products
          </Button>
          <Button to={paths.requestQuote} variant="outline" size="lg">
            Request a quotation
          </Button>
        </div>

        <div className="mt-12 grid gap-8 border-t border-concrete-200 pt-8 sm:grid-cols-3">
          {productCategories.map((category) => (
            <div key={category.id}>
              <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">
                <Link to={categoryUrl(category)} className="rounded-sm hover:text-terracotta">
                  {category.name}
                </Link>
              </h2>
              <ul className="mt-3 space-y-1.5">
                {getProductsByCategory(category.id).map((product) => (
                  <li key={product.id}>
                    <Link
                      to={productUrl(product)}
                      className="rounded-sm text-[13.5px] text-concrete-700 hover:text-charcoal"
                    >
                      {productDisplayName(product)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
