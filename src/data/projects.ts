import type { ProjectReference } from './types'

/**
 * VERIFIED PROJECT REFERENCES ONLY.
 *
 * This array is intentionally empty. No project names, clients, locations,
 * quantities, values, completion counts or testimonials were supplied, and
 * inventing them would misrepresent the business.
 *
 * While it is empty, /projects renders an honest "portfolio in
 * preparation" state plus an application-led explanation of where the
 * products are used. Add an entry here and the page switches to a real
 * project grid automatically — no component changes needed.
 *
 * Before adding an entry, confirm with the owner that the client is happy
 * to be mentioned publicly.
 */
export const projects: ProjectReference[] = []

export const activeProjects = projects
