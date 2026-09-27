# Product & project photographs

The site currently ships **no photographs**. Each product, category and service
renders a built-in technical illustration instead
(`src/components/visuals/ProductVisual.tsx`).

That is a deliberate decision, not an oversight:

- No company photographs were supplied.
- Generic stock or AI imagery must never be presented as photographs of
  Veer Hanuman project work — a contractor who recognises a stock photo stops
  trusting everything else on the page.
- The illustrations are honest about what they are, load instantly (inline SVG,
  no network request) and are visually distinct per product, so HDPE, DWC and
  EcoDrain do not all show the same pipe photograph.

## Adding real photographs

Drop files into this folder, then point the data layer at them. No component
changes are needed — wherever `image` is set, the photograph replaces the
illustration automatically.

1. Save the file here, e.g. `public/images/products/rcc-chambers.jpg`.
2. Open `src/data/catalogue.ts` and set the `image` field:

   ```ts
   {
     id: 'prd-rcc-chambers',
     name: 'RCC Chambers',
     image: '/images/products/rcc-chambers.jpg',   // was null
     gallery: [                                    // optional extra shots
       '/images/products/rcc-chambers-2.jpg',
       '/images/products/rcc-chambers-3.jpg',
     ],
     ...
   }
   ```

The same `image` field exists on product categories and on services.

### Recommended specs

| Use                  | Aspect ratio | Suggested width | Notes                              |
| -------------------- | ------------ | --------------- | ---------------------------------- |
| Product card / hero  | 4:3          | 1200 px         | Subject centred; it is cropped     |
| Product gallery      | 4:3          | 1200 px         | Any number of images               |
| Category card        | 4:3          | 1600 px         | Dark gradient overlays the bottom  |

- Prefer `.webp`, falling back to well-compressed `.jpg`. Aim for under 250 KB
  per image so the site stays quick on mobile data.
- All images are lazy-loaded except the one in a page header, which loads eagerly.
- Alt text is generated from the product name in the data layer, so there is
  nothing extra to write.

## Project photographs

`src/data/projects.ts` is intentionally empty. Add an entry there **only** once
the business owner has confirmed the project details *and* cleared the client
for public mention. Until then `/projects` shows an honest
"portfolio in preparation" state rather than placeholder cards.
