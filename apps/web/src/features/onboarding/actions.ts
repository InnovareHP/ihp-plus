'use server'

import { db } from '@ihp/db'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { isKnownOption } from '@/features/lookups/service'
import { requireSession } from '@/lib/auth-guard'
import { deleteObject, objectUrl, putObject, S3NotConfiguredError } from '@/lib/s3'
import { notifyAdminsOfNewMember } from './notifications'
import { generateIhpId } from './utils/ihp-id'
import { detectPhotoType, MAX_PHOTO_BYTES, photoExtension } from './utils/photo'
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

  // The chosen team is client input, so the organization comes from the team row, not the body.
  const team = await db.team.findUnique({
    where: { id: profile.teamId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!team) {
    return { ok: false, message: 'That department no longer exists — pick another one.' }
  }

  // The dropdowns are database-backed now, so the values they produce are checked against the
  // organization's own lists here rather than against a union compiled into the bundle.
  const [knownPosition, knownEmployment] = await Promise.all([
    isKnownOption(team.organizationId, 'position', profile.jobTitle),
    isKnownOption(team.organizationId, 'employmentType', profile.employmentType),
  ])
  if (!knownPosition) {
    return { ok: false, message: 'That position is not on the list — pick another one.' }
  }
  if (!knownEmployment) {
    return { ok: false, message: 'That employment type is not on the list — pick another one.' }
  }

  // Joining first: if this fails, onboardingCompletedAt is never set and the user can retry.
  // The other order left someone permanently onboarded with no department and no way back.
  const joined = await joinDepartment(session.user.id, team.id, team.organizationId)
  if (!joined) {
    return { ok: false, message: 'Could not join that department — try again in a moment.' }
  }

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

  // Not awaited: the profile is saved, and the admins being told is not the person's problem.
  void notifyAdminsOfNewMember({
    organizationId: team.organizationId,
    userId: session.user.id,
    memberName: profile.preferredName || fullName(profile.firstName, '', profile.lastName),
    teamName: team.name,
    jobTitle: profile.jobTitle,
  })

  return { ok: true }
}

// Both endpoints maintain teamMember.membershipKey and team.memberCount, which is why
// membership is never inserted directly.
async function joinDepartment(userId: string, teamId: string, organizationId: string) {
  // Whether they are already in the organization decides which endpoint applies: addMember
  // rejects an existing member outright, and its team join goes with it. The seeded owner is
  // exactly that case, and an existing role must not be overwritten with 'member' either.
  const existing = await db.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  })

  try {
    if (existing) {
      // Unlike addMember this one requires headers, so it runs as the signed-in caller.
      await auth.api.addTeamMember({
        body: { teamId, userId, organizationId },
        headers: await headers(),
      })
    } else {
      await auth.api.addMember({ body: { userId, role: 'member', organizationId, teamId } })
    }
    return true
  } catch {
    return false
  }
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
