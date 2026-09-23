import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  member: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const guard = vi.hoisted(() => ({ getSession: vi.fn(), readProfile: vi.fn() }))
const storage = vi.hoisted(() => ({ isObjectStorageConfigured: vi.fn(() => true) }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/s3', () => storage)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const { pendingPhotoUrl, profilePhotoKey, profilePhotoUrl } = await import('./profile-photo')

describe('profile photos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guard.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    guard.readProfile.mockResolvedValue({
      members: [{ role: 'member', organizationId: 'org-1' }],
      teammembers: [],
    })
    prisma.user.findUnique.mockResolvedValue({ photoKey: 'users/user-2/photo-abc.jpg' })
    prisma.member.findFirst.mockResolvedValue({ id: 'member-2' })
  })

  it('versions the link by the stored file, so a new photo is a new URL', () => {
    expect(profilePhotoUrl('user-2', 'users/user-2/photo-abc.jpg')).toBe(
      '/app/api/people/user-2/photo?v=photo-abc.jpg',
    )
    expect(profilePhotoUrl('user-2', null)).toBeUndefined()

    storage.isObjectStorageConfigured.mockReturnValue(false)
    expect(profilePhotoUrl('user-2', 'users/user-2/photo-abc.jpg')).toBeUndefined()
  })

  it('serves a colleague in the same organization', async () => {
    await expect(profilePhotoKey('user-2')).resolves.toEqual({
      status: 'ok',
      key: 'users/user-2/photo-abc.jpg',
    })
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-2' },
      select: { id: true },
    })
  })

  it('will not serve somebody from another organization', async () => {
    prisma.member.findFirst.mockResolvedValue(null)

    await expect(profilePhotoKey('user-9')).resolves.toEqual({ status: 'not-found' })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('asks a signed-out caller to sign in', async () => {
    guard.getSession.mockResolvedValue(null)

    await expect(profilePhotoKey('user-2')).resolves.toEqual({ status: 'unauthenticated' })
  })

  it('lets someone preview a photo they just uploaded, and only from their own uploads', async () => {
    expect(pendingPhotoUrl('user-1', 'users/user-1/photo-new.png')).toBe(
      '/app/api/people/user-1/photo?pending=users%2Fuser-1%2Fphoto-new.png',
    )
    await expect(profilePhotoKey('user-1', 'users/user-1/photo-new.png')).resolves.toEqual({
      status: 'ok',
      key: 'users/user-1/photo-new.png',
    })
    await expect(profilePhotoKey('user-1', 'clients/org-1/contract.pdf')).resolves.toEqual({
      status: 'not-found',
    })
    // Someone else's pending key is ignored: a colleague only ever gets the saved photo.
    await expect(profilePhotoKey('user-2', 'users/user-2/photo-new.png')).resolves.toEqual({
      status: 'ok',
      key: 'users/user-2/photo-abc.jpg',
    })
  })
})
