import { describe, expect, it } from 'vitest'
import type { WebsiteRow } from '../schema'
import { AUTO_ROUND_WINDOW_MS, awaitingAutoRound, roundCounts, roundForPunch } from './rounds'

function site(id: string, checks: WebsiteRow['checks'] = {}): WebsiteRow {
  return {
    id,
    name: id,
    url: `https://${id}.example`,
    clientId: '',
    clientName: '',
    notes: '',
    checks,
  }
}

const UP = {
  status: 'up' as const,
  httpStatus: 200,
  responseMs: 100,
  error: '',
  note: '',
  checkedByName: 'Ada',
  checkedAt: '2026-10-09T01:00:00.000Z',
}

const punchedAt = '2026-10-09T01:00:00.000Z'
const now = Date.parse(punchedAt) + 30 * 1000

describe('roundForPunch', () => {
  it('maps the clock to the round it starts', () => {
    expect(roundForPunch(undefined)).toBeUndefined()
    expect(roundForPunch({ isOpen: true })).toBe('clock_in')
    expect(roundForPunch({ isOpen: false })).toBe('clock_out')
  })
})

describe('awaitingAutoRound', () => {
  it('waits while a recent punch has sites still unchecked', () => {
    expect(
      awaitingAutoRound([site('a'), site('b', { clock_in: UP })], 'clock_in', punchedAt, now),
    ).toBe(true)
  })

  it('stops once every site is checked, or the punch is old', () => {
    expect(awaitingAutoRound([site('a', { clock_in: UP })], 'clock_in', punchedAt, now)).toBe(false)
    expect(
      awaitingAutoRound(
        [site('a')],
        'clock_in',
        punchedAt,
        Date.parse(punchedAt) + AUTO_ROUND_WINDOW_MS + 1,
      ),
    ).toBe(false)
    expect(awaitingAutoRound([], 'clock_in', punchedAt, now)).toBe(false)
  })
})

describe('roundCounts', () => {
  it('counts each status and the unchecked', () => {
    expect(roundCounts([site('a', { clock_in: UP }), site('b')], 'clock_in')).toEqual({
      up: 1,
      issue: 0,
      down: 0,
      unchecked: 1,
    })
  })
})
