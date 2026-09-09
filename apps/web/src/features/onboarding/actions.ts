'use server'

import { db } from '@ihp/db'
import { requireSession } from '@/lib/auth-guard'
import { deleteObject, objectUrl, putObject, S3NotConfiguredError } from '@/lib/s3'
import { generateIhpId } from './ihp-id'
import { detectPhotoType, MAX_PHOTO_BYTES, photoExtension } from './photo'
import { onboardingSchema } from './schema'

// Long enough that two uploads in the same second cannot collide on one key.
function generateObjectSuffix() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}

export type CompleteOnboardingResult = { ok: true } | { ok: false; message: string }

function nullIfBlank(value: string) {
  return value === '' ? null : value
}

function dateOrNull(value: string) {
  return value === '' ? null : new Date(`${value}T00:00:00.000Z`)
}

function fullName(first: string, middle: string, last: string) {
  return [first, middle === '' ? '' : `${middle.toUpperCase()}.`, last].filter(Boolean).join(' ')
}

// This parse is the trust boundary; the same schema on the client only shapes the UX.
export async function completeOnboarding(values: unknown): Promise<CompleteOnboardingResult> {
  const session = await requireSession()
  const parsed = onboardingSchema.safeParse(values)

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Some of those answers are not valid — check the fields and retry.',
    }
  }

  const profile = parsed.data

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: fullName(profile.firstName, profile.middleInitial, profile.lastName),
        firstName: profile.firstName,
        lastName: profile.lastName,
        middleInitial: nullIfBlank(profile.middleInitial.toUpperCase()),
        preferredName: nullIfBlank(profile.preferredName),
        phone: nullIfBlank(profile.phone),
        dateOfBirth: dateOrNull(profile.dateOfBirth),
        jobTitle: profile.jobTitle,
        department: profile.department,
        employmentType: profile.employmentType,
        startDate: dateOrNull(profile.startDate),
        photoKey: profile.photoKey,
        // Issued once: a re-run of onboarding must not hand out a second company ID.
        ihpId: session.user.ihpId ?? generateIhpId(),
        onboardingCompletedAt: new Date(),
      },
    })
  } catch {
    return { ok: false, message: 'Could not save your profile — check your connection and retry.' }
  }

  return { ok: true }
}

export type UploadPhotoResult =
  { ok: true; key: string; url: string } | { ok: false; message: string }

// Uploaded before the profile is saved, so an abandoned signup leaves an object for the
// bucket's lifecycle rule to reap.
export async function uploadPhoto(formData: FormData): Promise<UploadPhotoResult> {
  const session = await requireSession()

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a photo file to upload.' }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: 'That photo is over 5 MB — choose a smaller one.' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = detectPhotoType(bytes)
  if (!type) {
    return { ok: false, message: 'That file is not a JPEG, PNG or WebP image.' }
  }

  const prefix = `users/${session.user.id}/`
  const key = `${prefix}photo-${generateObjectSuffix()}.${photoExtension(type)}`

  try {
    await putObject(key, bytes, type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: error.message }
    return { ok: false, message: 'Could not upload that photo — check your connection and retry.' }
  }

  // A replaced photo is the caller's claim, so it is only deleted inside this user's own prefix.
  const previousKey = formData.get('previousKey')
  if (typeof previousKey === 'string' && previousKey.startsWith(prefix) && previousKey !== key) {
    await deleteObject(previousKey).catch(() => undefined)
  }

  return { ok: true, key, url: await objectUrl(key) }
}
