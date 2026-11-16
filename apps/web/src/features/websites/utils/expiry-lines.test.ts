import { describe, expect, it } from 'vitest'
import { alertLines, expiringSoonCount, monthlyLines, type SiteExpiry } from './expiry-lines'

const now = new Date('2026-11-06T01:30:00.000Z')
const inDays = (days: number) =>
  new Date(now.getTime() + days * 86_400_000 + 3_600_000).toISOString()

const SITES: SiteExpiry[] = [
  { name: 'Alpha', domain: inDays(200), ssl: inDays(60) },
  { name: 'Beta', domain: inDays(7), ssl: inDays(45) },
  { name: 'Gamma', domain: undefined, ssl: inDays(30) },
]

describe('monthlyLines', () => {
  it('puts the soonest renewal first and says when a date was not available', () => {
    expect(monthlyLines(SITES, 'Asia/Manila', now)).toEqual([
      'Beta: domain Nov 13, 2026 (7 days), SSL Dec 21, 2026 (45 days)',
      'Gamma: domain not available, SSL Dec 6, 2026 (30 days)',
      'Alpha: domain May 25, 2027 (200 days), SSL Jan 5, 2027 (60 days)',
    ])
  })

  it('counts the sites with anything inside 30 days', () => {
    expect(expiringSoonCount(SITES, now)).toBe(2)
  })
})

describe('alertLines', () => {
  it('speaks only on alert days, so most days send nothing', () => {
    expect(alertLines(SITES, 'Asia/Manila', now)).toEqual([
      'Beta: domain expires Nov 13, 2026 (7 days)',
      'Gamma: SSL certificate expires Dec 6, 2026 (30 days)',
    ])
    expect(alertLines([{ name: 'Delta', domain: inDays(8), ssl: inDays(29) }], 'UTC', now)).toEqual(
      [],
    )
  })

  it('repeats an expired renewal weekly rather than daily', () => {
    const lapsed = (days: number): SiteExpiry => ({
      name: 'Old',
      domain: undefined,
      ssl: inDays(days),
    })

    expect(alertLines([lapsed(-7)], 'UTC', now)).toHaveLength(1)
    expect(alertLines([lapsed(-8)], 'UTC', now)).toEqual([])
  })
})
