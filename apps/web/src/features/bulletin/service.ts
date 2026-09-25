import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import type { z } from 'zod'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { MENTION_EVERYONE, mentionsEveryone, type MentionPerson } from '@/lib/mentions'
import { deleteObject } from '@/lib/s3'
import { bulletinImageUrl } from './image-url'
import { notifyMentions } from './notifications'
import {
  BULLETIN_MAX_POSTS,
  BULLETIN_PAGE_SIZE,
  BULLETIN_REACTIONS,
  bulletinSettingsSchema,
  commentFormSchema,
  DEFAULT_BULLETIN_SETTINGS,
  isBulletinReaction,
  postEditSchema,
  postFormSchema,
  postKindOf,
  SYSTEM_AUTHOR_NAME,
  type AcknowledgementList,
  type BulletinCommentRow,
  type BulletinSettingsRow,
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
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
    // Admins pin, and take down what should not be on the board.
    canModerate: canManageOrganization(membership),
  }
}

type Caller = Awaited<ReturnType<typeof requireMember>>

// Per viewer, because whether they have confirmed a post is part of reading it.
function postSelectFor(viewerId: string) {
  return {
    id: true,
    kind: true,
    authorId: true,
    body: true,
    pinnedAt: true,
    editedAt: true,
    createdAt: true,
    requiresAck: true,
    _count: { select: { comments: true, acknowledgements: true } },
    acknowledgements: { where: { userId: viewerId }, select: { userId: true } },
    reactions: { select: { userId: true, emoji: true } },
    images: { select: { id: true }, orderBy: { position: 'asc' } },
  } satisfies Prisma.BulletinPostSelect
}

const commentSelect = {
  id: true,
  postId: true,
  authorId: true,
  body: true,
  editedAt: true,
  createdAt: true,
} satisfies Prisma.BulletinCommentSelect

type PostRecord = Prisma.BulletinPostGetPayload<{ select: ReturnType<typeof postSelectFor> }>
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
  memberCount: number,
): BulletinPostRow {
  return {
    id: post.id,
    kind: postKindOf(post.kind),
    authorId: post.authorId ?? '',
    authorName: post.authorId
      ? (names.get(post.authorId) ?? 'Removed teammate')
      : SYSTEM_AUTHOR_NAME,
    body: post.body,
    pinnedAt: post.pinnedAt?.toISOString(),
    editedAt: post.editedAt?.toISOString(),
    createdAt: post.createdAt.toISOString(),
    commentCount: post._count.comments,
    reactions: summarizeReactions(post.reactions, viewerId),
    images: post.images.map((image) => ({ id: image.id, url: bulletinImageUrl(image.id) })),
    requiresAck: post.requiresAck,
    acknowledgedByMe: post.acknowledgements.length > 0,
    ackCount: post._count.acknowledgements,
    // Whoever wrote it is not asked to confirm their own words.
    ackAudience: Math.max(memberCount - (post.authorId ? 1 : 0), 0),
  }
}

function memberCount(caller: Caller) {
  return db.member.count({ where: { organizationId: caller.organizationId } })
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
    select: postSelectFor(caller.userId),
  })
  if (!post) throw new ConnectError('That post is no longer on the board.', Code.NotFound)
  const [names, members] = await Promise.all([
    peopleNames([post.authorId ?? '']),
    memberCount(caller),
  ])
  return toPostRow(post, names, caller.userId, members)
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

// The composer's ids are checked against the organization rather than trusted: a mention emails
// someone. "@everyone" is expanded here, and only where the caller may address the whole company.
async function mentionableIds(
  caller: Caller,
  userIds: readonly string[],
  body: string,
  allowEveryone: boolean,
) {
  const everyone = allowEveryone && mentionsEveryone(body, userIds)
  const wanted = [...new Set(userIds)].filter(
    (id) => id !== caller.userId && id !== MENTION_EVERYONE,
  )
  if (!everyone && wanted.length === 0) return []

  const members = await db.member.findMany({
    where: {
      organizationId: caller.organizationId,
      ...(everyone ? {} : { userId: { in: wanted } }),
    },
    select: { userId: true },
  })

  return members.map((member) => member.userId).filter((userId) => userId !== caller.userId)
}

/** Everyone a composer can offer after "@": names only, since every member sees this list. */
export async function loadPeople(): Promise<MentionPerson[]> {
  const caller = await requireMember()

  const members = await db.member.findMany({
    where: { organizationId: caller.organizationId, userId: { not: caller.userId } },
    select: { user: { select: { id: true, name: true, preferredName: true } } },
  })

  return members
    .map((member) => ({
      userId: member.user.id,
      name: member.user.preferredName ?? member.user.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadFeed(limit: number): Promise<BulletinFeed> {
  const caller = await requireMember()
  const take = Math.min(Math.max(limit || BULLETIN_PAGE_SIZE, 1), BULLETIN_MAX_POSTS)

  const posts = await db.bulletinPost.findMany({
    where: { organizationId: caller.organizationId },
    select: postSelectFor(caller.userId),
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    // One past the page tells the client whether there is anything older without a count query.
    take: take + 1,
  })

  const page = posts.slice(0, take)
  const [names, members] = await Promise.all([
    peopleNames(page.map((post) => post.authorId ?? '')),
    memberCount(caller),
  ])

  return {
    posts: page.map((post) => toPostRow(post, names, caller.userId, members)),
    hasMore: posts.length > take,
    viewerId: caller.userId,
    canModerate: caller.canModerate,
  }
}

// Only admins post for now: the board is company news, and members answer it in the replies.
export async function createPost(
  body: string,
  imageIds: readonly string[] = [],
  mentionUserIds: readonly string[] = [],
  requiresAck = false,
): Promise<BulletinPostRow> {
  const caller = await requireMember()
  if (!caller.canModerate) {
    throw new ConnectError('Only an admin can post to the board.', Code.PermissionDenied)
  }
  const values = parseBody(
    postFormSchema.safeParse({
      body,
      imageIds: [...new Set(imageIds)],
      mentionUserIds: [...mentionUserIds],
      requiresAck,
    }),
  )

  // Only the caller's own photos that no post has claimed yet can go on this one.
  const images = await db.bulletinImage.findMany({
    where: {
      id: { in: values.imageIds },
      organizationId: caller.organizationId,
      uploadedById: caller.userId,
      postId: null,
    },
    select: { id: true },
  })
  if (images.length !== values.imageIds.length) {
    throw new ConnectError('A photo did not finish uploading — add it again.', Code.InvalidArgument)
  }

  const post = await db.$transaction(async (tx) => {
    const created = await tx.bulletinPost.create({
      data: {
        organizationId: caller.organizationId,
        authorId: caller.userId,
        body: values.body,
        requiresAck: values.requiresAck,
      },
      select: { id: true },
    })
    for (const [position, imageId] of values.imageIds.entries()) {
      await tx.bulletinImage.update({
        where: { id: imageId },
        data: { postId: created.id, position },
      })
    }
    return created
  })

  // Posting is admin-only, so a post is allowed to reach everyone at once.
  const mentioned = await mentionableIds(caller, values.mentionUserIds, values.body, true)
  await recordMentions(caller, post.id, undefined, mentioned)
  await notifyMentions({
    postId: post.id,
    authorName: caller.name,
    inReply: false,
    body: values.body,
    userIds: mentioned,
  })

  return readPost(caller, post.id)
}

async function recordMentions(
  caller: Caller,
  postId: string,
  commentId: string | undefined,
  userIds: readonly string[],
) {
  if (userIds.length === 0) return
  await db.bulletinMention.createMany({
    data: userIds.map((userId) => ({
      organizationId: caller.organizationId,
      postId,
      commentId: commentId ?? null,
      userId,
    })),
  })
}

/** The storage key behind a photo, for anyone in its organization; an unclaimed one is its uploader's. */
export async function bulletinImageKey(imageId: string): Promise<string> {
  const caller = await requireMember()
  const image = await db.bulletinImage.findFirst({
    where: { id: imageId, organizationId: caller.organizationId },
    select: { fileKey: true, postId: true, uploadedById: true },
  })
  if (!image || (image.postId === null && image.uploadedById !== caller.userId)) {
    throw new ConnectError('That photo is no longer on the board.', Code.NotFound)
  }
  return image.fileKey
}

// Editing stays with the author: an admin rewriting someone's words would put them in their mouth.
export async function updatePost(postId: string, body: string): Promise<BulletinPostRow> {
  const caller = await requireMember()
  const values = parseBody(postEditSchema.safeParse({ body }))
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

  const images = await db.bulletinImage.findMany({
    where: { postId: post.id },
    select: { fileKey: true },
  })
  await db.bulletinPost.delete({ where: { id: post.id } })
  // The rows went with the post; a photo left in the bucket would be a file nobody can reach.
  await Promise.allSettled(images.map((image) => deleteObject(image.fileKey)))
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

export async function createComment(
  postId: string,
  body: string,
  mentionUserIds: readonly string[] = [],
): Promise<BulletinCommentRow> {
  const caller = await requireMember()
  const values = parseBody(
    commentFormSchema.safeParse({ body, mentionUserIds: [...mentionUserIds] }),
  )
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

  // Any member replies, so a reply names people one by one and never the whole company.
  const mentioned = await mentionableIds(caller, values.mentionUserIds, values.body, false)
  await recordMentions(caller, post.id, comment.id, mentioned)
  await notifyMentions({
    postId: post.id,
    authorName: caller.name,
    inReply: true,
    body: values.body,
    userIds: mentioned,
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

const settingsSelect = {
  celebrateBirthdays: true,
  celebrateAnniversaries: true,
  welcomeNewHires: true,
} satisfies Prisma.BulletinSettingsSelect

function requireModerator(caller: Caller, message: string) {
  if (!caller.canModerate) throw new ConnectError(message, Code.PermissionDenied)
}

export async function loadSettings(): Promise<BulletinSettingsRow> {
  const caller = await requireMember()
  requireModerator(caller, 'Only an admin sets up automatic posts.')

  const settings = await db.bulletinSettings.findUnique({
    where: { organizationId: caller.organizationId },
    select: settingsSelect,
  })
  return settings ?? DEFAULT_BULLETIN_SETTINGS
}

export async function saveSettings(values: BulletinSettingsRow): Promise<BulletinSettingsRow> {
  const caller = await requireMember()
  requireModerator(caller, 'Only an admin sets up automatic posts.')
  const settings = parseBody(bulletinSettingsSchema.safeParse(values))

  return db.bulletinSettings.upsert({
    where: { organizationId: caller.organizationId },
    create: { organizationId: caller.organizationId, ...settings },
    update: settings,
    select: settingsSelect,
  })
}

export async function setPostRequiresAck(
  postId: string,
  required: boolean,
): Promise<BulletinPostRow> {
  const caller = await requireMember()
  requireModerator(caller, 'Only an admin can ask everyone to confirm a post.')

  const post = await postOrThrow(caller, postId)
  // Turning it off keeps who already confirmed, so turning it back on loses nobody's answer.
  await db.bulletinPost.update({ where: { id: post.id }, data: { requiresAck: required } })

  return readPost(caller, post.id)
}

export async function acknowledgePost(postId: string): Promise<BulletinPostRow> {
  const caller = await requireMember()
  const post = await db.bulletinPost.findFirst({
    where: { id: postId, organizationId: caller.organizationId },
    select: { id: true, authorId: true, requiresAck: true },
  })
  if (!post) throw new ConnectError('That post is no longer on the board.', Code.NotFound)
  if (!post.requiresAck) {
    throw new ConnectError('That post no longer asks for a confirmation.', Code.FailedPrecondition)
  }
  if (post.authorId === caller.userId) {
    throw new ConnectError(
      'You wrote this post, so there is nothing to confirm.',
      Code.FailedPrecondition,
    )
  }

  await db.bulletinAcknowledgement.upsert({
    where: { postId_userId: { postId: post.id, userId: caller.userId } },
    create: { postId: post.id, userId: caller.userId },
    update: {},
  })

  return readPost(caller, post.id)
}

/** Who has confirmed a post and who is still to, for the admin chasing it up. */
export async function loadAcknowledgements(postId: string): Promise<AcknowledgementList> {
  const caller = await requireMember()
  requireModerator(caller, 'Only an admin can see who has confirmed a post.')
  const post = await postOrThrow(caller, postId)

  const [members, acknowledgements] = await Promise.all([
    db.member.findMany({
      where: {
        organizationId: caller.organizationId,
        ...(post.authorId ? { userId: { not: post.authorId } } : {}),
      },
      select: { user: { select: { id: true, name: true, preferredName: true } } },
    }),
    db.bulletinAcknowledgement.findMany({
      where: { postId: post.id },
      select: { userId: true, acknowledgedAt: true },
    }),
  ])

  const confirmedAt = new Map(
    acknowledgements.map((row) => [row.userId, row.acknowledgedAt.toISOString()]),
  )
  const people = members
    .map((member) => ({
      userId: member.user.id,
      name: member.user.preferredName ?? member.user.name,
      acknowledgedAt: confirmedAt.get(member.user.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    confirmed: people.filter((person) => person.acknowledgedAt),
    waiting: people.filter((person) => !person.acknowledgedAt),
  }
}

// Someone who has never opened the board counts from the day they joined, not from the first post.
async function lastSeen(caller: Caller) {
  const [state, member] = await Promise.all([
    db.bulletinReadState.findUnique({
      where: {
        organizationId_userId: { organizationId: caller.organizationId, userId: caller.userId },
      },
      select: { lastSeenAt: true },
    }),
    db.member.findFirst({
      where: { organizationId: caller.organizationId, userId: caller.userId },
      select: { createdAt: true },
    }),
  ])
  return state?.lastSeenAt ?? member?.createdAt ?? new Date(0)
}

/** What the sidebar badge counts: new posts by others, and replies that named the caller. */
export async function loadUnreadCount(): Promise<number> {
  const caller = await requireMember()
  const since = await lastSeen(caller)

  const [posts, mentions] = await Promise.all([
    db.bulletinPost.count({
      where: {
        organizationId: caller.organizationId,
        createdAt: { gt: since },
        // A null author is the portal itself, which SQL would drop from a plain "not me".
        OR: [{ authorId: null }, { authorId: { not: caller.userId } }],
      },
    }),
    db.bulletinMention.count({
      where: {
        organizationId: caller.organizationId,
        userId: caller.userId,
        commentId: { not: null },
        createdAt: { gt: since },
      },
    }),
  ])

  return posts + mentions
}

/** Records a visit and hands back the one before it, which is where "new" starts on screen. */
export async function markSeen(): Promise<string | undefined> {
  const caller = await requireMember()
  const key = { organizationId: caller.organizationId, userId: caller.userId }

  const previous = await db.bulletinReadState.findUnique({
    where: { organizationId_userId: key },
    select: { lastSeenAt: true },
  })
  await db.bulletinReadState.upsert({
    where: { organizationId_userId: key },
    create: { ...key, lastSeenAt: new Date() },
    update: { lastSeenAt: new Date() },
  })

  return previous?.lastSeenAt.toISOString()
}
