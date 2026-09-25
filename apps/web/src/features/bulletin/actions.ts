'use server'

import { db } from '@ihp/db'
import { canManageOrganization, getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { putObject, S3NotConfiguredError } from '@/lib/s3'
import { bulletinImageUrl } from './image-url'
import { bulletinImageProblem, type BulletinImageRow } from './schema'

export type ImageUploadResult =
  { ok: true; data: BulletinImageRow } | { ok: false; message: string }

const NO_STORAGE = 'File storage is not configured yet — tell an admin to set the S3 variables.'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// A server action rather than an RPC: Connect would carry the bytes as base64 for no gain.
export async function uploadBulletinImage(formData: FormData): Promise<ImageUploadResult> {
  const session = await getSession()
  const profile = session ? await readProfile(session.user.id) : null
  if (!session || !profile) return { ok: false, message: 'Sign in to continue.' }

  const membership = membershipOf(profile)
  if (!membership.organizationId) {
    return { ok: false, message: 'Finish setting up your profile first.' }
  }
  if (!canManageOrganization(membership)) {
    return { ok: false, message: 'Only an admin can post to the board.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a photo to add.' }

  const problem = bulletinImageProblem(file)
  if (problem) return { ok: false, message: problem }

  const key = `bulletin/${membership.organizationId}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? 'img'}`

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    console.error('[bulletin] photo upload failed', error)
    return { ok: false, message: 'Could not store that photo — try again.' }
  }

  const image = await db.bulletinImage.create({
    data: {
      organizationId: membership.organizationId,
      fileKey: key,
      contentType: file.type,
      fileSize: file.size,
      uploadedById: session.user.id,
    },
    select: { id: true },
  })

  return { ok: true, data: { id: image.id, url: bulletinImageUrl(image.id) } }
}
