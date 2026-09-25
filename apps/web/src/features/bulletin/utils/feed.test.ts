import { describe, expect, it } from 'vitest'
import { feedLimitFromParam, sortFeed, toggleReactionIn } from './feed'
import type { BulletinPostRow } from '../schema'

function post(id: string, createdAt: string, pinnedAt?: string): BulletinPostRow {
  return {
    id,
    kind: 'post',
    requiresAck: false,
    acknowledgedByMe: false,
    ackCount: 0,
    ackAudience: 0,
    authorId: 'user-1',
    authorName: 'Dana',
    body: id,
    pinnedAt,
    editedAt: undefined,
    createdAt,
    commentCount: 0,
    reactions: [],
    images: [],
  }
}

describe('sortFeed', () => {
  it('puts pinned first, newest pin on top, then the rest newest first', () => {
    const sorted = sortFeed([
      post('old', '2026-09-01T00:00:00Z'),
      post('pinned-early', '2026-08-01T00:00:00Z', '2026-09-02T00:00:00Z'),
      post('new', '2026-09-10T00:00:00Z'),
      post('pinned-late', '2026-07-01T00:00:00Z', '2026-09-05T00:00:00Z'),
    ])

    expect(sorted.map((row) => row.id)).toEqual(['pinned-late', 'pinned-early', 'new', 'old'])
  })
})

describe('toggleReactionIn', () => {
  it('adds a new reaction in palette order', () => {
    expect(toggleReactionIn([{ emoji: '🎉', count: 2, reactedByMe: false }], '👍')).toEqual([
      { emoji: '👍', count: 1, reactedByMe: true },
      { emoji: '🎉', count: 2, reactedByMe: false },
    ])
  })

  it('joins an existing reaction', () => {
    expect(toggleReactionIn([{ emoji: '🎉', count: 2, reactedByMe: false }], '🎉')).toEqual([
      { emoji: '🎉', count: 3, reactedByMe: true },
    ])
  })

  it('drops the chip when the viewer was the only one', () => {
    expect(toggleReactionIn([{ emoji: '🎉', count: 1, reactedByMe: true }], '🎉')).toEqual([])
  })
})

describe('feedLimitFromParam', () => {
  it('falls back to one page for junk and caps a huge value', () => {
    expect(feedLimitFromParam(null)).toBe(20)
    expect(feedLimitFromParam('abc')).toBe(20)
    expect(feedLimitFromParam('5')).toBe(20)
    expect(feedLimitFromParam('40')).toBe(40)
    expect(feedLimitFromParam('99999')).toBe(200)
  })
})
