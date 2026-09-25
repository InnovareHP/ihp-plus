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

// "post" is written by a person; the rest are written by the daily celebrations job.
export const POST_KINDS = ['post', 'birthday', 'anniversary', 'welcome'] as const

export type PostKind = (typeof POST_KINDS)[number]

export type CelebrationKind = Exclude<PostKind, 'post'>

export const CELEBRATION_LABELS: Record<CelebrationKind, string> = {
  birthday: 'Birthday',
  anniversary: 'Work anniversary',
  welcome: 'New hire',
}

export function postKindOf(value: string): PostKind {
  return (POST_KINDS as readonly string[]).includes(value) ? (value as PostKind) : 'post'
}

/** The name a portal-written post goes out under. */
export const SYSTEM_AUTHOR_NAME = 'IHP+'

export const bulletinSettingsSchema = z.object({
  celebrateBirthdays: z.boolean(),
  celebrateAnniversaries: z.boolean(),
  welcomeNewHires: z.boolean(),
})

export type BulletinSettingsRow = z.infer<typeof bulletinSettingsSchema>

export const DEFAULT_BULLETIN_SETTINGS: BulletinSettingsRow = {
  celebrateBirthdays: true,
  celebrateAnniversaries: true,
  welcomeNewHires: true,
}

/** How many posts the feed loads per step of "Show older posts". */
export const BULLETIN_PAGE_SIZE = 20

/** A ceiling on ?show= so a hand-typed URL cannot ask for the whole table. */
export const BULLETIN_MAX_POSTS = 200

/** A grid of four still reads at a glance; more belongs in a shared folder. */
export const MAX_BULLETIN_IMAGES = 4

export const MAX_BULLETIN_IMAGE_BYTES = 10 * 1024 * 1024

// The types our image route will serve back, so nothing is stored that could not be shown.
export const BULLETIN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function bulletinImageProblem(file: { size: number; type: string }) {
  if (file.size === 0) return 'That photo is empty.'
  if (!(BULLETIN_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Add a JPEG, PNG or WebP photo.'
  }
  if (file.size > MAX_BULLETIN_IMAGE_BYTES) return 'Photos have to be 10 MB or smaller.'
  return undefined
}

const postBody = z.string().trim().max(4000, 'A post can run to 4000 characters.')

/** What an edit changes: the words only, since the photos are part of what was announced. */
export const postEditSchema = z.object({
  body: postBody.min(1, 'Write something before saving.'),
})

export type PostEditValues = z.infer<typeof postEditSchema>

// Ids behind the @names picked in a composer; the server re-checks every one before emailing.
const mentionIds = z.array(z.string().min(1)).max(50, 'Mention up to 50 people at a time.')

export const postFormSchema = z
  .object({
    body: postBody,
    imageIds: z
      .array(z.string().min(1))
      .max(MAX_BULLETIN_IMAGES, `A post can carry up to ${MAX_BULLETIN_IMAGES} photos.`),
    mentionUserIds: mentionIds,
  })
  .refine((values) => values.body.length > 0 || values.imageIds.length > 0, {
    message: 'Write something or add a photo before posting.',
    path: ['body'],
  })

export type PostFormValues = z.infer<typeof postFormSchema>

export const commentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a reply before sending.')
    .max(2000, 'A reply can run to 2000 characters.'),
  mentionUserIds: mentionIds,
})

export type CommentFormValues = z.infer<typeof commentFormSchema>

export interface ReactionSummaryRow {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface BulletinImageRow {
  id: string
  url: string
}

export interface BulletinPostRow {
  id: string
  kind: PostKind
  /** Empty on a post the portal wrote itself. */
  authorId: string
  authorName: string
  body: string
  pinnedAt: string | undefined
  editedAt: string | undefined
  createdAt: string
  commentCount: number
  reactions: ReactionSummaryRow[]
  images: BulletinImageRow[]
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
