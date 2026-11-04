import { CHECK_ROUNDS, type Checklist } from '../schema'

/** How long after a check the card keeps waiting for its picture before calling it missing. */
export const SNAPSHOT_WAIT_MS = 2 * 60 * 1000

// Storage and app clocks can disagree a little, so a picture taken just "before" the check still counts.
const CLOCK_SKEW_MS = 30 * 1000

export type SnapshotState = 'none' | 'ready' | 'pending' | 'missing'

/**
 * A picture belongs to a check only when it was taken after that check ran; an older one shows a
 * page as it was before the recheck, so it is not offered as this check's snapshot.
 */
export function snapshotStateOf(input: {
  /** Today's list, with pictures switched on. */
  shown: boolean
  checkedAt: string | undefined
  snapshotAt: string | undefined
  now: number
}): SnapshotState {
  if (!input.shown || !input.checkedAt) return 'none'
  const checked = Date.parse(input.checkedAt)
  if (input.snapshotAt && Date.parse(input.snapshotAt) >= checked - CLOCK_SKEW_MS) return 'ready'
  return input.now - checked < SNAPSHOT_WAIT_MS ? 'pending' : 'missing'
}

/** Whether any of today's checks is still waiting on its picture, so the list should look again. */
export function awaitsSnapshots(list: Checklist, now: number) {
  if (!list.snapshotsEnabled || list.date !== list.today) return false
  return list.websites.some((site) =>
    CHECK_ROUNDS.some(
      (round) =>
        snapshotStateOf({
          shown: true,
          checkedAt: site.checks[round]?.checkedAt,
          snapshotAt: site.snapshots[round],
          now,
        }) === 'pending',
    ),
  )
}
