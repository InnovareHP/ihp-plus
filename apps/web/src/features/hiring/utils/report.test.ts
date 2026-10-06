import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGES, type Stage } from '../schema'
import {
  formatDays,
  formatShare,
  funnelOf,
  outcomesOf,
  reportSince,
  type ReportApplication,
} from './report'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-06-01T00:00:00Z')

function application(patch: Partial<ReportApplication> = {}): ReportApplication {
  return {
    postingId: 'post-1',
    stageId: 'applied',
    status: 'active',
    createdAt: START,
    decidedAt: null,
    movedTo: [],
    ...patch,
  }
}

function hiredAfter(days: number) {
  return application({
    status: 'hired',
    stageId: 'offer',
    decidedAt: new Date(START.getTime() + days * DAY),
  })
}

describe('reportSince', () => {
  it('counts back from now, and leaves all time open', () => {
    const now = new Date('2026-10-06T00:00:00Z')
    expect(reportSince('30d', now)).toEqual(new Date('2026-09-06T00:00:00Z'))
    expect(reportSince('all', now)).toBeUndefined()
  })
})

describe('outcomesOf', () => {
  it('counts each outcome and takes the median days to hire', () => {
    const outcomes = outcomesOf([
      application(),
      application({ status: 'rejected' }),
      application({ status: 'withdrawn' }),
      hiredAfter(10),
      hiredAfter(20),
      hiredAfter(40),
    ])

    expect(outcomes).toEqual({
      applications: 6,
      active: 1,
      hired: 3,
      rejected: 1,
      withdrawn: 1,
      medianDaysToHire: 20,
    })
  })

  it('averages the middle two for an even count, and has no median without a hire', () => {
    expect(outcomesOf([hiredAfter(10), hiredAfter(15)]).medianDaysToHire).toBe(13)
    expect(outcomesOf([application()]).medianDaysToHire).toBeUndefined()
  })
})

describe('funnelOf', () => {
  const postings = [{ id: 'post-1', stages: [...DEFAULT_STAGES] }]

  it('counts an applicant at every stage up to the furthest one they reached', () => {
    const funnel = funnelOf(
      [
        application(),
        application({ stageId: 'interview', movedTo: ['screening', 'interview'] }),
        // Rejected after reaching the offer, so they still count there.
        application({ status: 'rejected', stageId: 'offer', movedTo: ['offer'] }),
        hiredAfter(5),
      ],
      postings,
    )

    expect(funnel).toEqual([
      { name: 'Applied', reached: 4 },
      { name: 'Screening', reached: 3 },
      { name: 'Interview', reached: 3 },
      { name: 'Offer', reached: 2 },
      { name: 'Hired', reached: 1 },
    ])
  })

  it('merges stages with the same name across postings and keeps the extra ones', () => {
    const custom: Stage[] = [
      { id: 'applied', name: 'Applied', message: '' },
      { id: 'skills-test', name: 'Skills test', message: '' },
      { id: 'final', name: 'interview', message: '' },
    ]
    const funnel = funnelOf(
      [application(), application({ postingId: 'post-2', stageId: 'final' })],
      [...postings, { id: 'post-2', stages: custom }],
    )

    expect(funnel.map((step) => [step.name, step.reached])).toEqual([
      ['Applied', 2],
      ['Screening', 0],
      ['Interview', 1],
      ['Offer', 0],
      ['Skills test', 1],
      ['Hired', 0],
    ])
  })

  it('ignores a stage id the posting no longer has', () => {
    const funnel = funnelOf([application({ stageId: 'gone', movedTo: ['gone'] })], postings)
    expect(funnel[0]).toEqual({ name: 'Applied', reached: 1 })
    expect(funnel[1]).toEqual({ name: 'Screening', reached: 0 })
  })
})

describe('formatting', () => {
  it('reads a share of nothing as zero and names days plainly', () => {
    expect(formatShare(1, 4)).toBe('25%')
    expect(formatShare(0, 0)).toBe('0%')
    expect(formatDays(1)).toBe('1 day')
    expect(formatDays(12)).toBe('12 days')
    expect(formatDays(undefined)).toBe('No hires yet')
  })
})
