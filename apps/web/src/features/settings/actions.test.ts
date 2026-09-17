import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }))
const guard = vi.hoisted(() => ({ requireSession: vi.fn() }))
const s3 = vi.hoisted(() => ({ deleteObject: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/lib/s3', () => s3)

const { updateContactDetails } = await import('./actions')

const DETAILS = {
  preferredName: 'Ada',
  phone: '(609) 555-0134',
  photoKey: 'users/user-1/photo-new.jpg',
}

describe('updateContactDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    guard.requireSession.mockResolvedValue({ user: { id: 'user-1' } })
    prisma.user.findUnique.mockResolvedValue({ photoKey: 'users/user-1/photo-old.jpg' })
    prisma.user.update.mockResolvedValue({})
    s3.deleteObject.mockResolvedValue(undefined)
  })

  it('saves the details on the signed-in person, storing a cleared field as empty', async () => {
    expect(await updateContactDetails({ ...DETAILS, preferredName: '' })).toEqual({ ok: true })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        preferredName: null,
        phone: '(609) 555-0134',
        photoKey: 'users/user-1/photo-new.jpg',
      },
    })
  })

  it('removes the replaced photo only once the save has succeeded', async () => {
    await updateContactDetails(DETAILS)

    expect(s3.deleteObject).toHaveBeenCalledWith('users/user-1/photo-old.jpg')
    expect(s3.deleteObject.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.user.update.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('keeps the photo on file when the save fails', async () => {
    prisma.user.update.mockRejectedValue(new Error('connection reset'))

    const result = await updateContactDetails(DETAILS)

    expect(result).toMatchObject({ ok: false })
    expect(s3.deleteObject).not.toHaveBeenCalled()
  })

  it("refuses a photo key outside the person's own uploads", async () => {
    const result = await updateContactDetails({ ...DETAILS, photoKey: 'users/user-2/photo.jpg' })

    expect(result).toEqual({
      ok: false,
      message: 'That photo could not be used. Upload it again.',
      field: 'photoKey',
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('names the field a validation failure belongs to', async () => {
    expect(await updateContactDetails({ ...DETAILS, phone: 'call me' })).toEqual({
      ok: false,
      message: 'Enter a phone number we can dial',
      field: 'phone',
    })
  })
})
