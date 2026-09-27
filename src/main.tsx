import './index.css'
import { hydrate } from './content/store'

/**
 * Boot sequence.
 *
 * Content is fetched BEFORE the app module is imported, so every
 * module-level value derived from it (the catalogue maps in src/data, the
 * contact helpers in src/lib/contact) is computed against live CMS data.
 *
 * This is why the app is loaded with a dynamic import rather than a static
 * one. Adding `import App from './App'` at the top of this file would
 * evaluate those modules too early and quietly pin the site to the bundled
 * seed snapshot. See src/content/store.ts.
 *
 * If the API is unreachable, hydrate() resolves to 'seed' and the site still
 * renders from the snapshot shipped with the build.
 */
async function boot() {
  await hydrate()

  const [{ mount }] = await Promise.all([import('./mount')])
  mount()
}

void boot()
