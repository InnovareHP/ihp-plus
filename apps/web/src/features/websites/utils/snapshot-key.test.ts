import { describe, expect, it } from 'vitest'
import { parseSnapshotKey, snapshotKey, snapshotPrefix } from './snapshot-key'

describe('snapshotKey', () => {
  it('files each picture under the organization, the day and the site', () => {
    expect(snapshotKey('org-1', '2026-11-03', 'site-1', 'clock_in', 'thumb')).toBe(
      'website-snapshots/org-1/2026-11-03/site-1/clock_in-thumb.webp',
    )
    expect(snapshotPrefix('org-1', '2026-11-03')).toBe('website-snapshots/org-1/2026-11-03/')
    expect(snapshotPrefix('org-1', '2026-11-03', 'site-1')).toBe(
      'website-snapshots/org-1/2026-11-03/site-1/',
    )
  })
})

describe('parseSnapshotKey', () => {
  it('reads a key back into the site, round and size it was written for', () => {
    const key = snapshotKey('org-1', '2026-11-03', 'site-1', 'clock_out', 'full')

    expect(parseSnapshotKey(key)).toEqual({
      organizationId: 'org-1',
      dateKey: '2026-11-03',
      websiteId: 'site-1',
      round: 'clock_out',
      size: 'full',
    })
  })

  it('skips keys that are not snapshots', () => {
    expect(parseSnapshotKey('attendance/org-1/user-1/in.jpg')).toBeUndefined()
    expect(parseSnapshotKey('website-snapshots/org-1/2026-11-03/site-1/lunch-thumb.webp')).toBe(
      undefined,
    )
    expect(parseSnapshotKey('website-snapshots/org-1/2026-11-03/site-1/clock_in-huge.webp')).toBe(
      undefined,
    )
    expect(parseSnapshotKey('website-snapshots/org-1/yesterday/site-1/clock_in-thumb.webp')).toBe(
      undefined,
    )
  })
})
