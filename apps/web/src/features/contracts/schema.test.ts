import { describe, expect, it } from 'vitest'
import { composeTerms, type CatalogItemRow } from './schema'

function item(overrides: Partial<CatalogItemRow> & { id: string }): CatalogItemRow {
  return {
    category: 'Bundles',
    name: 'Growth',
    description: undefined,
    priceMinCents: 450_000,
    priceMaxCents: 450_000,
    unit: 'month',
    percentOfSpend: undefined,
    defaultTerms: undefined,
    archived: false,
    ...overrides,
  }
}

const TEMPLATE = { scopeTemplate: 'Scope\n- Platforms:', standardTerms: 'Fees\nDue in 15 days.' }

describe('composeTerms', () => {
  it('puts what the services commit to first, then the scope, then the conditions', () => {
    const terms = composeTerms({
      lines: [{ catalogItemId: 'growth' }],
      catalog: [item({ id: 'growth', defaultTerms: 'Growth bundle: three platforms.' })],
      template: TEMPLATE,
    })

    expect(terms).toBe(
      [
        'What is included',
        '- Growth bundle: three platforms.',
        '',
        'Scope',
        '- Platforms:',
        '',
        'Fees',
        'Due in 15 days.',
      ].join('\n'),
    )
  })

  it('names a service once however many times it is on the contract', () => {
    const terms = composeTerms({
      lines: [{ catalogItemId: 'growth' }, { catalogItemId: 'growth' }],
      catalog: [item({ id: 'growth', defaultTerms: 'Growth bundle: three platforms.' })],
      template: undefined,
    })

    expect(terms.match(/Growth bundle/g)).toHaveLength(1)
  })

  it('follows the order of the contract, not the rate card', () => {
    const terms = composeTerms({
      lines: [{ catalogItemId: 'rush' }, { catalogItemId: 'growth' }],
      catalog: [
        item({ id: 'growth', defaultTerms: 'Growth bundle.' }),
        item({ id: 'rush', category: 'Add-ons', defaultTerms: 'Rush surcharge.' }),
      ],
      template: undefined,
    })

    expect(terms.indexOf('Rush surcharge.')).toBeLessThan(terms.indexOf('Growth bundle.'))
  })

  it('skips a service that commits to nothing rather than leaving an empty bullet', () => {
    const terms = composeTerms({
      lines: [{ catalogItemId: 'plain' }],
      catalog: [item({ id: 'plain', defaultTerms: undefined })],
      template: TEMPLATE,
    })

    expect(terms).not.toContain('What is included')
    expect(terms).toContain('Scope')
  })

  it('ignores a line typed by hand, which has no catalog row behind it', () => {
    const terms = composeTerms({
      lines: [{ catalogItemId: undefined }],
      catalog: [item({ id: 'growth', defaultTerms: 'Growth bundle.' })],
      template: TEMPLATE,
    })

    expect(terms).not.toContain('Growth bundle.')
  })

  it('returns nothing at all when an organization has no template and picked nothing', () => {
    expect(composeTerms({ lines: [], catalog: [], template: undefined })).toBe('')
  })

  it('leaves no blank run where a template section is empty', () => {
    const terms = composeTerms({
      lines: [],
      catalog: [],
      template: { scopeTemplate: 'Scope', standardTerms: '' },
    })

    expect(terms).toBe('Scope')
  })
})
