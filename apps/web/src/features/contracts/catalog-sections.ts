import type { CatalogItemRow } from './schema'

export interface CatalogSectionGroup {
  section: string
  items: CatalogItemRow[]
}

/**
 * Sections in the admin's list order, then any section since retired from the list
 * alphabetically, so an item filed under a retired section never drops off the rate card.
 */
export function groupBySection(
  items: readonly CatalogItemRow[],
  sectionOrder: readonly string[],
): CatalogSectionGroup[] {
  const bySection = new Map<string, CatalogItemRow[]>()
  for (const item of items) {
    const group = bySection.get(item.category)
    if (group) group.push(item)
    else bySection.set(item.category, [item])
  }

  const listed = sectionOrder.filter((section) => bySection.has(section))
  const retired = [...bySection.keys()]
    .filter((section) => !sectionOrder.includes(section))
    .sort((a, b) => a.localeCompare(b))

  return [...listed, ...retired].map((section) => ({
    section,
    items: bySection.get(section) ?? [],
  }))
}
