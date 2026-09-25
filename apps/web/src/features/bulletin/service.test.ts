import { Code } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  bulletinPost: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bulletinComment: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  bulletinReaction: { deleteMany: vi.fn(), upsert: vi.fn() },
  user: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  loadFeed,
  setPostPinned,
  summarizeReactions,
  toggleReaction,
  updatePost,
} = await import('./service')

const POST_RECORD = {
  id: 'post-1',
  authorId: 'user-2',
  body: 'Office closed Friday.',
  pinnedAt: null,
  editedAt: null,
  createdAt: new Date('2026-09-20T09:00:00.000Z'),
  _count: { comments: 3 },
  reactions: [
    { userId: 'user-1', emoji: '🎉' },
    { userId: 'user-2', emoji: '👍' },
    { userId: 'user-3', emoji: '🎉' },
  ],
}

function signInAs(organizationRole: 'member' | 'admin') {
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: 'user',
    members: [{ role: organizationRole, organizationId: 'org-1', organization: null }],
    teammembers: [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Dana Reyes' } })
  signInAs('member')
  prisma.user.findMany.mockResolvedValue([
    { id: 'user-2', name: 'Grace Hopper', preferredName: 'Grace' },
  ])
  prisma.bulletinPost.findFirst.mockResolvedValue(POST_RECORD)
})

describe('summarizeReactions', () => {
  it('counts per emoji in palette order and marks the viewer’s own', () => {
    expect(summarizeReactions(POST_RECORD.reactions, 'user-1')).toEqual([
      { emoji: '👍', count: 1, reactedByMe: false },
      { emoji: '🎉', count: 2, reactedByMe: true },
    ])
  })
})

describe('loadFeed', () => {
  it('puts pinned posts first and says whether older posts exist', async () => {
    prisma.bulletinPost.findMany.mockResolvedValue([POST_RECORD, { ...POST_RECORD, id: 'post-2' }])

    const feed = await loadFeed(1)

    expect(prisma.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: 2,
      }),
    )
    expect(feed.posts).toHaveLength(1)
    expect(feed.hasMore).toBe(true)
    expect(feed.posts[0]).toMatchObject({ authorName: 'Grace', commentCount: 3 })
    expect(feed).toMatchObject({ viewerId: 'user-1', canModerate: false })
  })

  it('refuses a caller without a session', async () => {
    guard.getSession.mockResolvedValue(null)

    await expect(loadFeed(20)).rejects.toMatchObject({ code: Code.Unauthenticated })
  })
})

describe('createPost', () => {
  it('rejects an empty post', async () => {
    await expect(createPost('   ')).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(prisma.bulletinPost.create).not.toHaveBeenCalled()
  })

  it('files the post under the caller and their organization', async () => {
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1' })

    await createPost('  Welcome, Ada!  ')

    expect(prisma.bulletinPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { organizationId: 'org-1', authorId: 'user-1', body: 'Welcome, Ada!' },
      }),
    )
  })
})

describe('updatePost', () => {
  it('lets nobody but the author edit, admins included', async () => {
    signInAs('admin')

    await expect(updatePost('post-1', 'Rewritten')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    expect(prisma.bulletinPost.update).not.toHaveBeenCalled()
  })
})

describe('deletePost', () => {
  it('refuses a member removing someone else’s post', async () => {
    await expect(deletePost('post-1')).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(prisma.bulletinPost.delete).not.toHaveBeenCalled()
  })

  it('lets an admin take any post down', async () => {
    signInAs('admin')

    await deletePost('post-1')

    expect(prisma.bulletinPost.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } })
  })

  it('says so when the post is in another organization', async () => {
    prisma.bulletinPost.findFirst.mockResolvedValue(null)

    await expect(deletePost('post-9')).rejects.toMatchObject({ code: Code.NotFound })
  })
})

describe('setPostPinned', () => {
  it('refuses a member', async () => {
    await expect(setPostPinned('post-1', true)).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    expect(prisma.bulletinPost.update).not.toHaveBeenCalled()
  })

  it('pins for an admin and records who pinned it', async () => {
    signInAs('admin')

    await setPostPinned('post-1', true)

    expect(prisma.bulletinPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { pinnedAt: expect.any(Date), pinnedById: 'user-1' },
    })
  })

  it('clears the pin', async () => {
    signInAs('admin')

    await setPostPinned('post-1', false)

    expect(prisma.bulletinPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { pinnedAt: null, pinnedById: null },
    })
  })
})

describe('toggleReaction', () => {
  it('rejects an emoji outside the palette', async () => {
    await expect(toggleReaction('post-1', '💩')).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
  })

  it('removes a reaction the caller already left', async () => {
    prisma.bulletinReaction.deleteMany.mockResolvedValue({ count: 1 })

    await toggleReaction('post-1', '🎉')

    expect(prisma.bulletinReaction.upsert).not.toHaveBeenCalled()
  })

  it('adds one the caller had not left', async () => {
    prisma.bulletinReaction.deleteMany.mockResolvedValue({ count: 0 })

    await toggleReaction('post-1', '👍')

    expect(prisma.bulletinReaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { postId: 'post-1', userId: 'user-1', emoji: '👍' } }),
    )
  })
})

describe('comments', () => {
  it('rejects an empty reply', async () => {
    await expect(createComment('post-1', '')).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
  })

  it('refuses a member deleting someone else’s reply', async () => {
    prisma.bulletinComment.findFirst.mockResolvedValue({ id: 'comment-1', authorId: 'user-2' })

    await expect(deleteComment('comment-1')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })

  it('lets the author delete their own reply', async () => {
    prisma.bulletinComment.findFirst.mockResolvedValue({ id: 'comment-1', authorId: 'user-1' })

    await deleteComment('comment-1')

    expect(prisma.bulletinComment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } })
  })
})
