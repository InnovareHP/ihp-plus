import { z } from 'zod'

// A fixed palette rather than a free emoji picker: the server can check every value, and a
// row of six reads at a glance where a hundred would not.
export const BULLETIN_REACTIONS = ['👍', '❤️', '🎉', '😂', '😮', '🙏'] as const

export type BulletinReaction = (typeof BULLETIN_REACTIONS)[number]

export const BULLETIN_REACTION_LABELS: Record<BulletinReaction, string> = {
  '👍': 'Thumbs up',
  '❤️': 'Heart',
  '🎉': 'Celebrate',
  '😂': 'Laugh',
  '😮': 'Surprised',
  '🙏': 'Thanks',
}

export function isBulletinReaction(value: string): value is BulletinReaction {
  return (BULLETIN_REACTIONS as readonly string[]).includes(value)
}

/** How many posts the feed loads per step of "Show older posts". */
export const BULLETIN_PAGE_SIZE = 20

/** A ceiling on ?show= so a hand-typed URL cannot ask for the whole table. */
export const BULLETIN_MAX_POSTS = 200

export const postFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something before posting.')
    .max(4000, 'A post can run to 4000 characters.'),
})

export type PostFormValues = z.infer<typeof postFormSchema>

export const commentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a reply before sending.')
    .max(2000, 'A reply can run to 2000 characters.'),
})

export type CommentFormValues = z.infer<typeof commentFormSchema>

export interface ReactionSummaryRow {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface BulletinPostRow {
  id: string
  authorId: string
  authorName: string
  body: string
  pinnedAt: string | undefined
  editedAt: string | undefined
  createdAt: string
  commentCount: number
  reactions: ReactionSummaryRow[]
  /** Set only on an optimistic row the server has not acknowledged yet. */
  isSending?: boolean
}

export interface BulletinCommentRow {
  id: string
  postId: string
  authorId: string
  authorName: string
  body: string
  editedAt: string | undefined
  createdAt: string
  isSending?: boolean
}

export interface BulletinFeed {
  posts: BulletinPostRow[]
  hasMore: boolean
  viewerId: string
  canModerate: boolean
}
