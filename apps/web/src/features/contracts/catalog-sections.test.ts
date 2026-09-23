import { describe, expect, it } from 'vitest'
import { groupBySection } from './catalog-sections'
import type { CatalogItemRow } from './schema'

function item(id: string, category: string): CatalogItemRow {
  return {
    id,
    category,
    name: id,
    description: undefined,
    priceMinCents: 0,
    priceMaxCents: 0,
    unit: 'project',
    percentOfSpend: undefined,
    defaultTerms: undefined,
    archived: false,
  }
}

describe('groupBySection', () => {
  it('follows the admin list order and skips empty sections', () => {
    const groups = groupBySection(
      [item('a', 'Website'), item('b', 'Bundles'), item('c', 'Website')],
      ['Bundles', 'IT department', 'Website'],
    )

    expect(groups.map((group) => group.section)).toEqual(['Bundles', 'Website'])
    expect(groups[1]?.items.map((row) => row.id)).toEqual(['a', 'c'])
  })

  it('keeps items in a retired section, after the listed ones', () => {
    const groups = groupBySection(
      [item('a', 'Legacy'), item('b', 'Website'), item('c', 'Archive')],
      ['Website'],
    )

    expect(groups.map((group) => group.section)).toEqual(['Website', 'Archive', 'Legacy'])
  })
})
