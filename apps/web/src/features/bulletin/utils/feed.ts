import type { BulletinFeed, BulletinPostRow, ReactionSummaryRow } from '../schema'
import { BULLETIN_MAX_POSTS, BULLETIN_PAGE_SIZE, BULLETIN_REACTIONS } from '../schema'

// The server's order, repeated on the client so an optimistic pin lands where the refetch will.
export function sortFeed(posts: readonly BulletinPostRow[]): BulletinPostRow[] {
  return [...posts].sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt)
    if (a.pinnedAt) return -1
    if (b.pinnedAt) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function patchPost(
  feed: BulletinFeed,
  postId: string,
  patch: (post: BulletinPostRow) => BulletinPostRow,
): BulletinFeed {
  return { ...feed, posts: feed.posts.map((post) => (post.id === postId ? patch(post) : post)) }
}

// Flips the viewer's own reaction; the palette order keeps the chip row from reshuffling.
export function toggleReactionIn(
  reactions: readonly ReactionSummaryRow[],
  emoji: string,
): ReactionSummaryRow[] {
  const current = reactions.find((reaction) => reaction.emoji === emoji)
  const others = reactions.filter((reaction) => reaction.emoji !== emoji)

  const next: ReactionSummaryRow | undefined = !current
    ? { emoji, count: 1, reactedByMe: true }
    : current.reactedByMe
      ? current.count > 1
        ? { emoji, count: current.count - 1, reactedByMe: false }
        : undefined
      : { emoji, count: current.count + 1, reactedByMe: true }

  const merged = next ? [...others, next] : others
  const order = BULLETIN_REACTIONS as readonly string[]
  return merged.sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji))
}

// ?show= is hand-editable, so anything odd falls back to one page and nothing exceeds the cap.
export function feedLimitFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < BULLETIN_PAGE_SIZE) return BULLETIN_PAGE_SIZE
  return Math.min(parsed, BULLETIN_MAX_POSTS)
}
