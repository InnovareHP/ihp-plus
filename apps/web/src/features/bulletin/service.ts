import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import type { z } from 'zod'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import {
  BULLETIN_MAX_POSTS,
  BULLETIN_PAGE_SIZE,
  BULLETIN_REACTIONS,
  commentFormSchema,
  isBulletinReaction,
  postFormSchema,
  type BulletinCommentRow,
  type BulletinFeed,
  type BulletinPostRow,
  type ReactionSummaryRow,
} from './schema'

async function requireMember() {
  const session = await getSession()
  if (!session) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const profile = await readProfile(session.user.id)
  if (!profile) throw new ConnectError('Sign in to continue.', Code.Unauthenticated)

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    throw new ConnectError('Finish setting up your profile first.', Code.FailedPrecondition)
  }

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    // Admins pin, and take down what should not be on the board.
    canModerate: canManageOrganization(membership),
  }
}

type Caller = Awaited<ReturnType<typeof requireMember>>

const postSelect = {
  id: true,
  authorId: true,
  body: true,
  pinnedAt: true,
  editedAt: true,
  createdAt: true,
  _count: { select: { comments: true } },
  reactions: { select: { userId: true, emoji: true } },
} satisfies Prisma.BulletinPostSelect

const commentSelect = {
  id: true,
  postId: true,
  authorId: true,
  body: true,
  editedAt: true,
  createdAt: true,
} satisfies Prisma.BulletinCommentSelect

type PostRecord = Prisma.BulletinPostGetPayload<{ select: typeof postSelect }>
type CommentRecord = Prisma.BulletinCommentGetPayload<{ select: typeof commentSelect }>

// One lookup for a whole feed: the same few people write most of it.
async function peopleNames(ids: readonly string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Map<string, string>()

  const people = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, preferredName: true },
  })

  return new Map(people.map((person) => [person.id, person.preferredName ?? person.name]))
}

// Palette order, not arrival order, so a reaction row never reshuffles under a click.
export function summarizeReactions(
  reactions: readonly { userId: string; emoji: string }[],
  viewerId: string,
): ReactionSummaryRow[] {
  return BULLETIN_REACTIONS.flatMap((emoji) => {
    const matching = reactions.filter((reaction) => reaction.emoji === emoji)
    if (matching.length === 0) return []
    return [
      {
        emoji,
        count: matching.length,
        reactedByMe: matching.some((reaction) => reaction.userId === viewerId),
      },
    ]
  })
}

function toPostRow(
  post: PostRecord,
  names: ReadonlyMap<string, string>,
  viewerId: string,
): BulletinPostRow {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: names.get(post.authorId) ?? 'Removed teammate',
    body: post.body,
    pinnedAt: post.pinnedAt?.toISOString(),
    editedAt: post.editedAt?.toISOString(),
    createdAt: post.createdAt.toISOString(),
    commentCount: post._count.comments,
    reactions: summarizeReactions(post.reactions, viewerId),
  }
}

function toCommentRow(comment: CommentRecord, names: ReadonlyMap<string, string>) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    authorName: names.get(comment.authorId) ?? 'Removed teammate',
    body: comment.body,
    editedAt: comment.editedAt?.toISOString(),
    createdAt: comment.createdAt.toISOString(),
  } satisfies BulletinCommentRow
}

async function readPost(caller: Caller, postId: string): Promise<BulletinPostRow> {
  const post = await db.bulletinPost.findFirst({
    where: { id: postId, organizationId: caller.organizationId },
    select: postSelect,
  })
  if (!post) throw new ConnectError('That post is no longer on the board.', Code.NotFound)
  return toPostRow(post, await peopleNames([post.authorId]), caller.userId)
}

async function postOrThrow(caller: Caller, postId: string) {
  const post = await db.bulletinPost.findFirst({
    where: { id: postId, organizationId: caller.organizationId },
    select: { id: true, authorId: true },
  })
  if (!post) throw new ConnectError('That post is no longer on the board.', Code.NotFound)
  return post
}

function parseBody<T>(result: z.ZodSafeParseResult<T>) {
  if (!result.success) {
    throw new ConnectError(
      result.error.issues[0]?.message ?? 'That could not be posted.',
      Code.InvalidArgument,
    )
  }
  return result.data
}

export async function loadFeed(limit: number): Promise<BulletinFeed> {
  const caller = await requireMember()
  const take = Math.min(Math.max(limit || BULLETIN_PAGE_SIZE, 1), BULLETIN_MAX_POSTS)

  const posts = await db.bulletinPost.findMany({
    where: { organizationId: caller.organizationId },
    select: postSelect,
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    // One past the page tells the client whether there is anything older without a count query.
    take: take + 1,
  })

  const page = posts.slice(0, take)
  const names = await peopleNames(page.map((post) => post.authorId))

  return {
    posts: page.map((post) => toPostRow(post, names, caller.userId)),
    hasMore: posts.length > take,
    viewerId: caller.userId,
    canModerate: caller.canModerate,
  }
}

export async function createPost(body: string): Promise<BulletinPostRow> {
  const caller = await requireMember()
  const values = parseBody(postFormSchema.safeParse({ body }))

  const post = await db.bulletinPost.create({
    data: { organizationId: caller.organizationId, authorId: caller.userId, body: values.body },
    select: { id: true },
  })

  return readPost(caller, post.id)
}

// Editing stays with the author: an admin rewriting someone's words would put them in their mouth.
export async function updatePost(postId: string, body: string): Promise<BulletinPostRow> {
  const caller = await requireMember()
  const values = parseBody(postFormSchema.safeParse({ body }))
  const post = await postOrThrow(caller, postId)

  if (post.authorId !== caller.userId) {
    throw new ConnectError('You can only edit your own posts.', Code.PermissionDenied)
  }

  await db.bulletinPost.update({
    where: { id: post.id },
    data: { body: values.body, editedAt: new Date() },
  })

  return readPost(caller, post.id)
}

export async function deletePost(postId: string): Promise<void> {
  const caller = await requireMember()
  const post = await postOrThrow(caller, postId)

  if (post.authorId !== caller.userId && !caller.canModerate) {
    throw new ConnectError('Only the author or an admin can remove a post.', Code.PermissionDenied)
  }

  await db.bulletinPost.delete({ where: { id: post.id } })
}

export async function setPostPinned(postId: string, pinned: boolean): Promise<BulletinPostRow> {
  const caller = await requireMember()
  if (!caller.canModerate) {
    throw new ConnectError('Only an admin can pin a post.', Code.PermissionDenied)
  }

  const post = await postOrThrow(caller, postId)
  await db.bulletinPost.update({
    where: { id: post.id },
    data: pinned
      ? { pinnedAt: new Date(), pinnedById: caller.userId }
      : { pinnedAt: null, pinnedById: null },
  })

  return readPost(caller, post.id)
}

export async function toggleReaction(postId: string, emoji: string): Promise<BulletinPostRow> {
  const caller = await requireMember()
  if (!isBulletinReaction(emoji)) {
    throw new ConnectError('That reaction is not on the board.', Code.InvalidArgument)
  }

  const post = await postOrThrow(caller, postId)
  const key = { postId: post.id, userId: caller.userId, emoji }

  // deleteMany is a no-op on a missing row, so two quick clicks cannot throw on each other.
  const removed = await db.bulletinReaction.deleteMany({ where: key })
  if (removed.count === 0) {
    await db.bulletinReaction.upsert({
      where: { postId_userId_emoji: key },
      create: key,
      update: {},
    })
  }

  return readPost(caller, post.id)
}

export async function loadComments(postId: string): Promise<BulletinCommentRow[]> {
  const caller = await requireMember()
  const post = await postOrThrow(caller, postId)

  const comments = await db.bulletinComment.findMany({
    where: { postId: post.id },
    select: commentSelect,
    orderBy: { createdAt: 'asc' },
  })

  const names = await peopleNames(comments.map((comment) => comment.authorId))
  return comments.map((comment) => toCommentRow(comment, names))
}

export async function createComment(postId: string, body: string): Promise<BulletinCommentRow> {
  const caller = await requireMember()
  const values = parseBody(commentFormSchema.safeParse({ body }))
  const post = await postOrThrow(caller, postId)

  const comment = await db.bulletinComment.create({
    data: {
      organizationId: caller.organizationId,
      postId: post.id,
      authorId: caller.userId,
      body: values.body,
    },
    select: commentSelect,
  })

  return toCommentRow(comment, await peopleNames([comment.authorId]))
}

export async function deleteComment(commentId: string): Promise<void> {
  const caller = await requireMember()
  const comment = await db.bulletinComment.findFirst({
    where: { id: commentId, organizationId: caller.organizationId },
    select: { id: true, authorId: true },
  })
  if (!comment) throw new ConnectError('That reply is no longer there.', Code.NotFound)

  if (comment.authorId !== caller.userId && !caller.canModerate) {
    throw new ConnectError('Only the author or an admin can remove a reply.', Code.PermissionDenied)
  }

  await db.bulletinComment.delete({ where: { id: comment.id } })
}
