import { db } from '@ihp/db'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { withBasePath } from '@/lib/routes'
import { isObjectStorageConfigured } from '@/lib/s3'

/**
 * A person's photo on our own domain. The key rides along as a version, so a new photo is a new
 * URL and a browser's private cache never shows the old face.
 */
export function profilePhotoUrl(userId: string, photoKey: string | null | undefined) {
  if (!photoKey || !isObjectStorageConfigured()) return undefined
  const version = photoKey.split('/').at(-1) ?? ''
  return withBasePath(
    `/api/people/${encodeURIComponent(userId)}/photo?v=${encodeURIComponent(version)}`,
  )
}

/** A photo just uploaded but not saved yet, which only its owner may preview. */
export function pendingPhotoUrl(userId: string, photoKey: string) {
  return withBasePath(
    `/api/people/${encodeURIComponent(userId)}/photo?pending=${encodeURIComponent(photoKey)}`,
  )
}

export type PhotoLookup =
  { status: 'ok'; key: string } | { status: 'unauthenticated' | 'not-found' }

/**
 * Which object to serve for somebody's photo: anyone signed in sees their own, and a colleague
 * in the same organization sees theirs. A pending key is honoured only inside the caller's own
 * upload prefix, so nobody can read an arbitrary object through this route.
 */
export async function profilePhotoKey(userId: string, pending?: string): Promise<PhotoLookup> {
  const session = await getSession()
  if (!session) return { status: 'unauthenticated' }

  const isSelf = session.user.id === userId
  if (isSelf && pending) {
    return pending.startsWith(`users/${userId}/`)
      ? { status: 'ok', key: pending }
      : { status: 'not-found' }
  }

  if (!isSelf) {
    const profile = await readProfile(session.user.id)
    const organizationId = profile ? membershipOf(profile).organizationId : undefined
    if (!organizationId) return { status: 'not-found' }

    const colleague = await db.member.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    })
    if (!colleague) return { status: 'not-found' }
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { photoKey: true } })
  return user?.photoKey ? { status: 'ok', key: user.photoKey } : { status: 'not-found' }
}
