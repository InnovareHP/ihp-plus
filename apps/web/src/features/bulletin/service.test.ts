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
  bulletinImage: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  bulletinSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  bulletinMention: { createMany: vi.fn() },
  bulletinAcknowledgement: { upsert: vi.fn(), findMany: vi.fn() },
  member: { findMany: vi.fn(), count: vi.fn() },
  user: { findMany: vi.fn() },
  // The transaction hands the same mocks back, so a write inside it is asserted like any other.
  $transaction: vi.fn(),
}))

const storage = vi.hoisted(() => ({ deleteObject: vi.fn() }))

const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const notices = vi.hoisted(() => ({ notifyMentions: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/s3', () => storage)
vi.mock('./notifications', () => notices)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  acknowledgePost,
  bulletinImageKey,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  loadAcknowledgements,
  loadFeed,
  loadPeople,
  loadSettings,
  saveSettings,
  setPostPinned,
  setPostRequiresAck,
  summarizeReactions,
  toggleReaction,
  updatePost,
} = await import('./service')

const POST_RECORD = {
  id: 'post-1',
  kind: 'post',
  authorId: 'user-2' as string | null,
  body: 'Office closed Friday.',
  pinnedAt: null,
  editedAt: null,
  createdAt: new Date('2026-09-20T09:00:00.000Z'),
  requiresAck: false,
  _count: { comments: 3, acknowledgements: 0 },
  acknowledgements: [] as { userId: string }[],
  images: [],
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
  prisma.member.count.mockResolvedValue(10)
  prisma.bulletinImage.findMany.mockResolvedValue([])
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma))
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
  beforeEach(() => signInAs('admin'))

  it('keeps posting to admins', async () => {
    signInAs('member')

    await expect(createPost('Hello')).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(prisma.bulletinPost.create).not.toHaveBeenCalled()
  })

  it('rejects a post with neither words nor photos', async () => {
    await expect(createPost('   ')).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(prisma.bulletinPost.create).not.toHaveBeenCalled()
  })

  it('files the post under the caller and their organization', async () => {
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1' })

    await createPost('  Welcome, Ada!  ')

    expect(prisma.bulletinPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId: 'org-1',
          authorId: 'user-1',
          body: 'Welcome, Ada!',
          requiresAck: false,
        },
      }),
    )
  })

  it('claims the caller’s own unclaimed photos, in the order they were picked', async () => {
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1' })
    prisma.bulletinImage.findMany.mockResolvedValue([{ id: 'img-2' }, { id: 'img-1' }])

    await createPost('', ['img-2', 'img-1'])

    expect(prisma.bulletinImage.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['img-2', 'img-1'] },
        organizationId: 'org-1',
        uploadedById: 'user-1',
        postId: null,
      },
      select: { id: true },
    })
    expect(prisma.bulletinImage.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'img-2' },
      data: { postId: 'post-1', position: 0 },
    })
    expect(prisma.bulletinImage.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'img-1' },
      data: { postId: 'post-1', position: 1 },
    })
  })

  it('refuses a photo that is somebody else’s or already on a post', async () => {
    prisma.bulletinImage.findMany.mockResolvedValue([])

    await expect(createPost('Look', ['img-9'])).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
    expect(prisma.bulletinPost.create).not.toHaveBeenCalled()
  })

  it('refuses more than four photos', async () => {
    await expect(createPost('Look', ['a', 'b', 'c', 'd', 'e'])).rejects.toMatchObject({
      code: Code.InvalidArgument,
    })
  })
})

describe('bulletinImageKey', () => {
  it('serves a posted photo to anyone in the organization', async () => {
    prisma.bulletinImage.findFirst.mockResolvedValue({
      fileKey: 'bulletin/org-1/a.jpg',
      postId: 'post-1',
      uploadedById: 'user-2',
    })

    await expect(bulletinImageKey('img-1')).resolves.toBe('bulletin/org-1/a.jpg')
    expect(prisma.bulletinImage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'img-1', organizationId: 'org-1' } }),
    )
  })

  it('keeps an unposted photo to the person who uploaded it', async () => {
    prisma.bulletinImage.findFirst.mockResolvedValue({
      fileKey: 'bulletin/org-1/a.jpg',
      postId: null,
      uploadedById: 'user-2',
    })

    await expect(bulletinImageKey('img-1')).rejects.toMatchObject({ code: Code.NotFound })
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

  it('lets an admin take any post down, photos and all', async () => {
    signInAs('admin')
    prisma.bulletinImage.findMany.mockResolvedValue([{ fileKey: 'bulletin/org-1/a.jpg' }])

    await deletePost('post-1')

    expect(prisma.bulletinPost.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } })
    expect(storage.deleteObject).toHaveBeenCalledWith('bulletin/org-1/a.jpg')
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

describe('portal-written posts', () => {
  it('go out under the portal’s name, and nobody can edit them', async () => {
    prisma.bulletinPost.findMany.mockResolvedValue([
      { ...POST_RECORD, kind: 'birthday', authorId: null },
    ])

    const feed = await loadFeed(20)

    expect(feed.posts[0]).toMatchObject({ kind: 'birthday', authorId: '', authorName: 'IHP+' })

    prisma.bulletinPost.findFirst.mockResolvedValue({ ...POST_RECORD, authorId: null })
    signInAs('admin')
    await expect(updatePost('post-1', 'Rewritten')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })
})

describe('automatic post settings', () => {
  it('are for admins only', async () => {
    await expect(loadSettings()).rejects.toMatchObject({ code: Code.PermissionDenied })
    await expect(
      saveSettings({
        celebrateBirthdays: false,
        celebrateAnniversaries: true,
        welcomeNewHires: true,
      }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('default to everything on before an admin has chosen', async () => {
    signInAs('admin')
    prisma.bulletinSettings.findUnique.mockResolvedValue(null)

    expect(await loadSettings()).toEqual({
      celebrateBirthdays: true,
      celebrateAnniversaries: true,
      welcomeNewHires: true,
    })
  })

  it('save per organization', async () => {
    signInAs('admin')
    const next = { celebrateBirthdays: false, celebrateAnniversaries: true, welcomeNewHires: true }
    prisma.bulletinSettings.upsert.mockResolvedValue(next)

    await saveSettings(next)

    expect(prisma.bulletinSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        create: { organizationId: 'org-1', ...next },
        update: next,
      }),
    )
  })
})

describe('mentions', () => {
  it('records and emails only colleagues from the caller’s own organization', async () => {
    signInAs('admin')
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1' })
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-2' }])

    await createPost('Thanks @Grace', [], ['user-2', 'user-from-elsewhere', 'user-1'])

    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: { in: ['user-2', 'user-from-elsewhere'] } },
      select: { userId: true },
    })
    expect(prisma.bulletinMention.createMany).toHaveBeenCalledWith({
      data: [{ organizationId: 'org-1', postId: 'post-1', commentId: null, userId: 'user-2' }],
    })
    expect(notices.notifyMentions).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'post-1', inReply: false, userIds: ['user-2'] }),
    )
  })

  it('lets an admin post reach @everyone, minus themselves', async () => {
    signInAs('admin')
    prisma.bulletinPost.create.mockResolvedValue({ id: 'post-1' })
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }])

    await createPost('Heads up @everyone', [], ['everyone'])

    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: { userId: true },
    })
    expect(notices.notifyMentions).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['user-2'] }),
    )
  })

  it('never lets a reply email the whole company', async () => {
    prisma.bulletinComment.create.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'user-1',
      body: 'Hi @everyone',
      editedAt: null,
      createdAt: new Date('2026-09-26T00:00:00.000Z'),
    })

    await createComment('post-1', 'Hi @everyone', ['everyone'])

    expect(prisma.member.findMany).not.toHaveBeenCalled()
    expect(prisma.bulletinMention.createMany).not.toHaveBeenCalled()
    expect(notices.notifyMentions).not.toHaveBeenCalledWith(
      expect.objectContaining({ userIds: expect.arrayContaining(['user-2']) }),
    )
  })

  it('records a mention in a reply against that reply', async () => {
    prisma.member.findMany.mockResolvedValue([{ userId: 'user-2' }])
    prisma.bulletinComment.create.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'user-1',
      body: '@Grace can you bring it?',
      editedAt: null,
      createdAt: new Date('2026-09-26T00:00:00.000Z'),
    })

    await createComment('post-1', '@Grace can you bring it?', ['user-2'])

    expect(prisma.bulletinMention.createMany).toHaveBeenCalledWith({
      data: [
        { organizationId: 'org-1', postId: 'post-1', commentId: 'comment-1', userId: 'user-2' },
      ],
    })
    expect(notices.notifyMentions).toHaveBeenCalledWith(
      expect.objectContaining({ inReply: true, userIds: ['user-2'] }),
    )
  })

  it('offers everyone else in the organization by name, alphabetically', async () => {
    prisma.member.findMany.mockResolvedValue([
      { user: { id: 'user-3', name: 'Zoe Park', preferredName: null } },
      { user: { id: 'user-2', name: 'Grace Hopper', preferredName: 'Grace' } },
    ])

    expect(await loadPeople()).toEqual([
      { userId: 'user-2', name: 'Grace' },
      { userId: 'user-3', name: 'Zoe Park' },
    ])
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', userId: { not: 'user-1' } } }),
    )
  })
})

describe('read confirmations', () => {
  it('counts who confirmed out of everyone but the author', async () => {
    prisma.bulletinPost.findMany.mockResolvedValue([
      {
        ...POST_RECORD,
        requiresAck: true,
        _count: { comments: 0, acknowledgements: 4 },
        acknowledgements: [{ userId: 'user-1' }],
      },
    ])

    const feed = await loadFeed(20)

    expect(feed.posts[0]).toMatchObject({
      requiresAck: true,
      acknowledgedByMe: true,
      ackCount: 4,
      ackAudience: 9,
    })
  })

  it('records a confirmation once, however often it is sent', async () => {
    prisma.bulletinPost.findFirst.mockResolvedValue({ ...POST_RECORD, requiresAck: true })

    await acknowledgePost('post-1')

    expect(prisma.bulletinAcknowledgement.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post-1', userId: 'user-1' } },
      create: { postId: 'post-1', userId: 'user-1' },
      update: {},
    })
  })

  it('refuses a confirmation nobody asked for, or from the author', async () => {
    prisma.bulletinPost.findFirst.mockResolvedValue({ ...POST_RECORD, requiresAck: false })
    await expect(acknowledgePost('post-1')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })

    prisma.bulletinPost.findFirst.mockResolvedValue({
      ...POST_RECORD,
      requiresAck: true,
      authorId: 'user-1',
    })
    await expect(acknowledgePost('post-1')).rejects.toMatchObject({
      code: Code.FailedPrecondition,
    })
    expect(prisma.bulletinAcknowledgement.upsert).not.toHaveBeenCalled()
  })

  it('lets only an admin ask for confirmation or see who gave it', async () => {
    await expect(setPostRequiresAck('post-1', true)).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
    await expect(loadAcknowledgements('post-1')).rejects.toMatchObject({
      code: Code.PermissionDenied,
    })
  })

  it('splits the company into confirmed and waiting, leaving the author out', async () => {
    signInAs('admin')
    prisma.member.findMany.mockResolvedValue([
      { user: { id: 'user-3', name: 'Zoe Park', preferredName: null } },
      { user: { id: 'user-4', name: 'Ada Lovelace', preferredName: 'Ada' } },
    ])
    prisma.bulletinAcknowledgement.findMany.mockResolvedValue([
      { userId: 'user-3', acknowledgedAt: new Date('2026-09-26T08:00:00.000Z') },
    ])

    const list = await loadAcknowledgements('post-1')

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: { not: 'user-2' } },
      }),
    )
    expect(list).toEqual({
      confirmed: [
        { userId: 'user-3', name: 'Zoe Park', acknowledgedAt: '2026-09-26T08:00:00.000Z' },
      ],
      waiting: [{ userId: 'user-4', name: 'Ada', acknowledgedAt: undefined }],
    })
  })
})
