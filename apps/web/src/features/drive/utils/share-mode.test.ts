import { afterEach, describe, expect, it } from 'vitest'
import { linkExpiry, sharesByLink } from './share-mode'

afterEach(() => {
  delete process.env.GRAPH_SHARE_MODE
  delete process.env.GRAPH_LINK_EXPIRY_DAYS
})

describe('sharesByLink', () => {
  it('is off unless the mode says otherwise, because a link names nobody', () => {
    expect(sharesByLink()).toBe(false)
  })

  it('is on for the link mode', () => {
    process.env.GRAPH_SHARE_MODE = 'link'
    expect(sharesByLink()).toBe(true)
  })

  it('ignores a value that is not a mode', () => {
    process.env.GRAPH_SHARE_MODE = 'anonymous'
    expect(sharesByLink()).toBe(false)
  })
})

describe('linkExpiry', () => {
  it('is undefined when no expiry is configured', () => {
    expect(linkExpiry()).toBeUndefined()
  })

  it('counts the configured days forward', () => {
    process.env.GRAPH_LINK_EXPIRY_DAYS = '30'
    const now = new Date('2026-03-04T10:00:00.000Z')

    expect(linkExpiry(now)).toBe('2026-04-03T10:00:00.000Z')
  })

  it('ignores a nonsense value rather than expiring the link at once', () => {
    process.env.GRAPH_LINK_EXPIRY_DAYS = 'soon'
    expect(linkExpiry()).toBeUndefined()
  })
})
