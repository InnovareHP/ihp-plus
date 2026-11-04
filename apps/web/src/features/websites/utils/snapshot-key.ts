import { CHECK_ROUNDS, type CheckRound } from '../schema'

// Everything under this prefix older than the organization's today is swept away, never kept.
export const SNAPSHOT_PREFIX = 'website-snapshots'

export const SNAPSHOT_SIZES = ['thumb', 'full'] as const
export type SnapshotSize = (typeof SNAPSHOT_SIZES)[number]

/** One day's snapshots for an organization, or for one of its sites. */
export function snapshotPrefix(organizationId: string, dateKey: string, websiteId?: string) {
  const day = `${SNAPSHOT_PREFIX}/${organizationId}/${dateKey}/`
  return websiteId ? `${day}${websiteId}/` : day
}

export function snapshotKey(
  organizationId: string,
  dateKey: string,
  websiteId: string,
  round: CheckRound,
  size: SnapshotSize,
) {
  return `${snapshotPrefix(organizationId, dateKey, websiteId)}${round}-${size}.webp`
}

export interface ParsedSnapshotKey {
  organizationId: string
  dateKey: string
  websiteId: string
  round: CheckRound
  size: SnapshotSize
}

const KEY = new RegExp(
  `^${SNAPSHOT_PREFIX}/([^/]+)/(\\d{4}-\\d{2}-\\d{2})/([^/]+)/([a-z_]+)-([a-z]+)\\.webp$`,
)

/** Reads a listed key back into its parts; anything that is not one of ours is skipped. */
export function parseSnapshotKey(key: string): ParsedSnapshotKey | undefined {
  const match = KEY.exec(key)
  if (!match) return undefined
  const [, organizationId, dateKey, websiteId, round, size] = match
  if (!organizationId || !dateKey || !websiteId || !round || !size) return undefined
  if (!(CHECK_ROUNDS as readonly string[]).includes(round)) return undefined
  if (!(SNAPSHOT_SIZES as readonly string[]).includes(size)) return undefined
  return {
    organizationId,
    dateKey,
    websiteId,
    round: round as CheckRound,
    size: size as SnapshotSize,
  }
}
