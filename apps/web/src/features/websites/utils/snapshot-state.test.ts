import { describe, expect, it } from 'vitest'
import type { Checklist } from '../schema'
import { awaitsSnapshots, SNAPSHOT_WAIT_MS, snapshotStateOf } from './snapshot-state'

const CHECKED = '2026-11-03T09:00:00.000Z'
const checkedMs = Date.parse(CHECKED)

describe('snapshotStateOf', () => {
  it('shows nothing on a past day or before the round has run', () => {
    expect(
      snapshotStateOf({ shown: false, checkedAt: CHECKED, snapshotAt: CHECKED, now: checkedMs }),
    ).toBe('none')
    expect(
      snapshotStateOf({ shown: true, checkedAt: undefined, snapshotAt: undefined, now: 0 }),
    ).toBe('none')
  })

  it('offers a picture taken after the check', () => {
    expect(
      snapshotStateOf({
        shown: true,
        checkedAt: CHECKED,
        snapshotAt: '2026-11-03T09:00:12.000Z',
        now: checkedMs,
      }),
    ).toBe('ready')
  })

  it('waits for the picture just after a check, then calls it missing', () => {
    const input = { shown: true, checkedAt: CHECKED, snapshotAt: undefined }

    expect(snapshotStateOf({ ...input, now: checkedMs + 5_000 })).toBe('pending')
    expect(snapshotStateOf({ ...input, now: checkedMs + SNAPSHOT_WAIT_MS + 1 })).toBe('missing')
  })

  it('does not pass off the picture from an earlier check as the recheck’s', () => {
    expect(
      snapshotStateOf({
        shown: true,
        checkedAt: CHECKED,
        snapshotAt: '2026-11-03T08:00:00.000Z',
        now: checkedMs + 1_000,
      }),
    ).toBe('pending')
  })
})

describe('awaitsSnapshots', () => {
  const list = (snapshotsEnabled: boolean): Checklist => ({
    date: '2026-11-03',
    today: '2026-11-03',
    timeZone: 'UTC',
    snapshotsEnabled,
    websites: [
      {
        id: 'site-1',
        name: 'Site',
        url: 'https://site.example',
        clientId: '',
        clientName: '',
        notes: '',
        checks: {
          clock_in: {
            status: 'up',
            httpStatus: 200,
            responseMs: 100,
            error: '',
            note: '',
            checkedByName: 'Ada',
            checkedAt: CHECKED,
          },
        },
        snapshots: {},
        shift: { pagesButtons: undefined, findings: '', action: '' },
        formEmail: undefined,
      },
    ],
  })

  it('keeps looking while a fresh check waits on its picture', () => {
    expect(awaitsSnapshots(list(true), checkedMs + 5_000)).toBe(true)
  })

  it('never waits where pictures are not set up', () => {
    expect(awaitsSnapshots(list(false), checkedMs + 5_000)).toBe(false)
  })
})
