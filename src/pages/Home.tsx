import { ApplicationsSection } from '../components/home/ApplicationsSection'
import { CategoryShowcase } from '../components/home/CategoryShowcase'
import { FeaturedProducts } from '../components/home/FeaturedProducts'
import { FinderSection } from '../components/home/FinderSection'
import { Hero } from '../components/home/Hero'
import { LandscapingSection } from '../components/home/LandscapingSection'
import { ProjectsTeaser } from '../components/home/ProjectsTeaser'
import { QuoteCta } from '../components/home/QuoteCta'
import { WhyUsSection } from '../components/home/WhyUsSection'
import { paths } from '../lib/paths'
import { organizationSchema, websiteSchema } from '../lib/schema'
import { Seo } from '../lib/seo'

export default function Home() {
  return (
    <>
      <Seo
        exactTitle
        title="Veer Hanuman Trading Co. | Construction & Infrastructure Products in Hyderabad"
        description="Veer Hanuman Trading Co. supplies RCC, FRP, drainage and piping products for construction, infrastructure and project requirements in Hyderabad and Telangana."
        path={paths.home}
        schema={[organizationSchema(), websiteSchema()]}
      />
      <Hero />
      <CategoryShowcase />
      <FinderSection />
      <ApplicationsSection />
      <WhyUsSection />
      <FeaturedProducts />
      <LandscapingSection />
      <ProjectsTeaser />
      <QuoteCta />
    </>
  )
}
