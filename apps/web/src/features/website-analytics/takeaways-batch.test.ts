import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REPORT_SITES } from './sites'

const service = vi.hoisted(() => ({
  takeawaysFor: vi.fn(),
  saveTakeaways: vi.fn(),
  siteReportFor: vi.fn(),
}))
vi.mock('./service', () => service)
vi.mock('./save', () => ({ reportOrganizationId: vi.fn(async () => 'org-1') }))
vi.mock('./takeaway-facts', () => ({
  ga4Facts: (site: { name: string }) => `Website: ${site.name}`,
  netlifyFacts: (site: { name: string }) => `Website: ${site.name}`,
}))

const { BATCH_AUTHOR, collectFacts, rangeProblem, saveDrafted, valuesOf } =
  await import('./takeaways-batch')

const RANGE = { start: '2026-10-25', end: '2026-11-24' }
const DRAFT = {
  observations: ['Traffic volume: 2,027 page views.', '  '],
  strengths: ['Fast pages:\n0.17 MB per page view.'],
  improvements: [],
  recommendations: ['Filter spam: review onesysteam.com.'],
}
const SAVED = {
  observations: 'Mine',
  strengths: '',
  improvements: '',
  recommendations: '',
  updatedAt: '2026-11-26T10:00:00Z',
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-26T15:00:00Z') })
  service.takeawaysFor.mockReset().mockResolvedValue(null)
  service.saveTakeaways.mockReset().mockResolvedValue(undefined)
  service.siteReportFor
    .mockReset()
    .mockImplementation(async (_org: string, site: { source: string }) => ({
      source: site.source,
      report: {},
    }))
})

describe('valuesOf', () => {
  it('puts one point per line and keeps each point on one line', () => {
    expect(valuesOf(DRAFT)).toEqual({
      observations: 'Traffic volume: 2,027 page views.',
      strengths: 'Fast pages: 0.17 MB per page view.',
      improvements: '',
      recommendations: 'Filter spam: review onesysteam.com.',
    })
  })
})

describe('rangeProblem', () => {
  it('accepts a finished range and refuses one that reaches today', () => {
    expect(rangeProblem(RANGE)).toBeNull()
    expect(rangeProblem({ start: '2026-11-01', end: '2026-11-26' })).toMatch(/yesterday/)
    expect(rangeProblem({ start: 'Nov 1', end: '2026-11-24' })).toMatch(/YYYY-MM-DD/)
  })
})

describe('collectFacts', () => {
  it('reads every site and names the ones that failed instead of stopping', async () => {
    service.siteReportFor.mockImplementation(async (_org: string, site: { key: string }) => {
      if (site.key === 'magnolia') throw new Error('quota exceeded')
      return { source: 'netlify', report: {} }
    })
    service.takeawaysFor.mockImplementation(async (_org: string, key: string) =>
      key === 'palm-grove' ? SAVED : null,
    )

    const sites = await collectFacts(RANGE)

    expect(sites).toHaveLength(REPORT_SITES.length)
    expect(sites.find((site) => site.key === 'magnolia')).toMatchObject({
      facts: null,
      error: 'quota exceeded',
    })
    expect(sites.find((site) => site.key === 'palm-grove')).toMatchObject({
      facts: 'Website: Palm Grove',
      hasSaved: true,
    })
  })
})

describe('saveDrafted', () => {
  const file = (takeaways: Record<string, typeof DRAFT>) => ({ range: RANGE, takeaways })

  it('only reports what it would save until asked to write', async () => {
    const outcome = await saveDrafted(file({ 'palm-grove': DRAFT }), {
      write: false,
      replace: false,
    })

    expect(outcome).toEqual({ saved: ['Palm Grove'], skipped: [] })
    expect(service.saveTakeaways).not.toHaveBeenCalled()
  })

  it('writes as Claude Code and leaves saved takeaways alone unless told to replace them', async () => {
    service.takeawaysFor.mockImplementation(async (_org: string, key: string) =>
      key === 'magnolia' ? SAVED : null,
    )
    const empty = { observations: [], strengths: [], improvements: [], recommendations: [] }

    const outcome = await saveDrafted(
      file({ 'palm-grove': DRAFT, magnolia: DRAFT, 'not-a-site': DRAFT, nbphs: empty }),
      { write: true, replace: false },
    )

    expect(outcome.saved).toEqual(['Palm Grove'])
    expect(outcome.skipped).toEqual([
      { site: 'Magnolia', reason: 'already has takeaways (pass --replace)' },
      { site: 'not-a-site', reason: 'not on the report list' },
      { site: 'NBPHS', reason: 'every section is empty' },
    ])
    expect(service.saveTakeaways).toHaveBeenCalledWith(
      'org-1',
      BATCH_AUTHOR,
      'palm-grove',
      RANGE,
      valuesOf(DRAFT),
    )

    await saveDrafted(file({ magnolia: DRAFT }), { write: true, replace: true })
    expect(service.saveTakeaways).toHaveBeenLastCalledWith(
      'org-1',
      BATCH_AUTHOR,
      'magnolia',
      RANGE,
      valuesOf(DRAFT),
    )
  })

  it('refuses a file in the wrong shape or with an unfinished range', async () => {
    await expect(saveDrafted({ takeaways: {} }, { write: true, replace: false })).rejects.toThrow(
      /expected shape/,
    )
    await expect(
      saveDrafted(
        { range: { start: '2026-11-01', end: '2026-11-26' }, takeaways: {} },
        { write: true, replace: false },
      ),
    ).rejects.toThrow(/yesterday/)
  })
})
