'use server'

import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { putObject, S3NotConfiguredError } from '@/lib/s3'
import { extensionFor, selfieProblem } from './schema'

export type SelfieUpload = { ok: true; key: string } | { ok: false; message: string }

const NO_STORAGE = 'Photo storage is not configured yet — tell an admin to set the S3 variables.'

/**
 * A server action rather than an RPC: Connect would carry the photo as base64 through the same
 * nginx body limit, for no gain over the multipart upload the platform already does.
 */
export async function uploadSelfie(formData: FormData): Promise<SelfieUpload> {
  const session = await getSession()
  if (!session) return { ok: false, message: 'Sign in to continue.' }

  const profile = await readProfile(session.user.id)
  const organizationId = profile ? membershipOf(profile).organizationId : undefined
  if (!organizationId) return { ok: false, message: 'Finish setting up your profile first.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Take the photo again.' }

  const problem = selfieProblem(file)
  if (problem) return { ok: false, message: problem }

  // Keyed by person so a stored photo is traceable to the punch it belongs to.
  const key = `attendance/${organizationId}/${session.user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not store that photo — try again.' }
  }

  return { ok: true, key }
}
