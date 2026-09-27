import {
  Boxes,
  Building,
  BuildingComplex,
  Cable,
  CircleDot,
  Construction,
  Cylinder,
  Droplets,
  Factory,
  House,
  Leaf,
  Route,
  type LucideIcon,
} from 'lucide-react'
import type { ApplicationIcon, RequirementIcon } from '../../data/types'

/**
 * Icon lookup for the taxonomy. Keeping the mapping here means the data
 * layer stores a plain icon name and never imports a component.
 *
 * Icons are always paired with a text label — never the only way a
 * meaning is conveyed.
 */

const applicationIcons: Record<ApplicationIcon, LucideIcon> = {
  road: Route,
  drainage: Droplets,
  residential: House,
  commercial: BuildingComplex,
  industrial: Factory,
  landscape: Leaf,
}

const requirementIcons: Record<RequirementIcon, LucideIcon> = {
  drainage: Droplets,
  manhole: CircleDot,
  utility: Cable,
  pipes: Cylinder,
  landscape: Leaf,
  construction: Construction,
}

export function getApplicationIcon(name: ApplicationIcon): LucideIcon {
  return applicationIcons[name] ?? Building
}

export function getRequirementIcon(name: RequirementIcon): LucideIcon {
  return requirementIcons[name] ?? Boxes
}
