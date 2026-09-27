import { useParams } from 'react-router-dom'
import NotFound from './NotFound'
import { ProductCard } from '../components/catalogue/ProductCard'
import { QuoteCta } from '../components/home/QuoteCta'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Section, SectionHeading } from '../components/ui/Section'
import { TagList } from '../components/ui/Tag'
import { WhatsAppButton } from '../components/ui/WhatsAppButton'
import { Visual } from '../components/visuals/ProductVisual'
import {
  getApplicationsForCategory,
  getCategoryBySlug,
  getProductsByCategory,
  getRequirementTagsForCategory,
  productDisplayName,
} from '../data'
import { requirementEnquiryMessage } from '../lib/contact'
import { applicationUrl, categoryUrl, finderUrl, paths } from '../lib/paths'
import { breadcrumbSchema, itemListSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

export default function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const category = getCategoryBySlug(categorySlug)

  /*
   * A family that is unpublished or archived in the CMS is absent from the
   * published content and lands here. Render the not-found page rather than
   * redirecting, so the URL stays put and nothing about the draft leaks.
   */
  if (!category) return <NotFound />

  const products = getProductsByCategory(category.id)
  const applications = getApplicationsForCategory(category.id)
  const requirements = getRequirementTagsForCategory(category.id)
  const path = categoryUrl(category)

  return (
    <>
      <Seo
        title={`${category.name} Products`}
        description={`${category.summary} Enquire with Veer Hanuman Trading Co., Hyderabad, for availability and a requirement-based quotation.`}
        path={path}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: paths.home },
            { name: 'Products', path: paths.products },
            { name: category.name, path },
          ]),
          itemListSchema(
            `${category.name} products`,
            products.map((product) => ({
              name: productDisplayName(product),
              path: `${path}/${product.slug}`,
            })),
          ),
        ]}
      />

      <PageHeader
        crumbs={[
          { name: 'Home', path: paths.home },
          { name: 'Products', path: paths.products },
          { name: category.name },
        ]}
        eyebrow="Product family"
        title={category.name}
        intro={category.description}
        actions={
          <>
            <Button to={paths.requestQuote} variant="accent" size="lg">
              Request a quotation
            </Button>
            <WhatsAppButton
              message={requirementEnquiryMessage(category.name)}
              size="lg"
              tone="onDark"
            />
          </>
        }
        aside={
          <div className="overflow-hidden border border-cream/15">
            <div className="aspect-[4/3] w-full">
              <Visual
                variant={category.visual}
                image={category.image}
                alt={`${category.name} products`}
                tone="dark"
                loading="eager"
              />
            </div>
          </div>
        }
      />

      <Section tone="cream">
        <SectionHeading
          eyebrow={`${products.length} ${products.length === 1 ? 'product' : 'products'}`}
          title={`Products in ${category.name}`}
          intro="Open a product for its applications, use cases and enquiry options."
        />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id} className="flex">
              <ProductCard product={product} showCategory={false} className="w-full" />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="concrete" divided>
        <SectionHeading
          eyebrow="Discovery"
          title="Applications & requirements"
          intro="Where products in this family are typically used. These are discovery groupings, not sub-categories of the product family."
        />
        <div className="grid gap-8 border border-concrete-200 bg-cream-100 p-6 sm:grid-cols-2">
          <TagList
            label="Applications"
            items={applications}
            tone="neutral"
            hrefFor={(slug) => applicationUrl(slug)}
          />
          <TagList
            label="Requirement tags"
            items={requirements}
            tone="accent"
            hrefFor={(slug) => finderUrl(slug)}
          />
        </div>
      </Section>

      <QuoteCta />
    </>
  )
}
