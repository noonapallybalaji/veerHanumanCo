import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * sitemap.xml and robots.txt are NOT generated here any more.
 *
 * They used to be emitted at build time from the seed files in src/data,
 * which meant they described the catalogue as it stood at the last build:
 * anything published through the CMS afterwards was missing, project URLs
 * were never included at all, and the origin came from the seed rather than
 * the company profile.
 *
 * Both are now served dynamically by the API from the database — see
 * server/src/routes/sitemap.ts. Emitting a static copy as well would defeat
 * that, because a static file at the same path wins at the proxy and the
 * dynamic route would never be reached.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssTarget: 'chrome80',
    // Keep an eye on payload size — this site has to stay quick on mobile data.
    chunkSizeWarningLimit: 400,
  },
})
