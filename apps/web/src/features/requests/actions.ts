'use server'

import { db } from '@ihp/db'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { putObject, S3NotConfiguredError } from '@/lib/s3'
import { fileProblem } from '@/features/bluebook/schema'
import { formFieldSchema, type UploadedFile } from './schema'

export type UploadResult = { ok: true; data: UploadedFile } | { ok: false; message: string }

const NO_STORAGE = 'File storage is not configured yet — tell an admin to set the S3 variables.'

// A server action rather than an RPC: Connect would carry the bytes as base64 through the same
// nginx body limit, for no gain over the multipart upload the platform already does.
async function caller() {
  const session = await getSession()
  if (!session) return null

  const profile = await readProfile(session.user.id)
  if (!profile) return null

  const membership = membershipOf(profile)
  if (!membership.organizationId || !membership.team) return null

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    teamId: membership.team.id,
  }
}

/** A safe object key: the original name is kept for the download, not for storage. */
function keyFor(organizationId: string, formId: string, fileName: string) {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `requests/${organizationId}/${formId}/${crypto.randomUUID()}-${safe.slice(-80)}`
}

/** Stored unclaimed; submitting the request is what attaches it, and only for the uploader. */
export async function uploadRequestFile(formData: FormData): Promise<UploadResult> {
  const who = await caller()
  if (!who) return { ok: false, message: 'Sign in to continue.' }

  const formId = String(formData.get('formId') ?? '')
  const fieldId = String(formData.get('fieldId') ?? '')
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a file to upload.' }

  const problem = fileProblem(file)
  if (problem) return { ok: false, message: problem }

  const form = await db.requestForm.findFirst({
    where: {
      id: formId,
      organizationId: who.organizationId,
      kind: 'request',
      status: 'published',
      teams: { some: { teamId: who.teamId } },
    },
    select: { id: true, fields: true },
  })
  if (!form) return { ok: false, message: 'That form is not open to your department.' }

  const fields = Array.isArray(form.fields) ? form.fields : []
  const asksForFile = fields.some((raw) => {
    const field = formFieldSchema.safeParse(raw)
    return field.success && field.data.id === fieldId && field.data.type === 'file'
  })
  if (!asksForFile) return { ok: false, message: 'That question does not take a file.' }

  const key = keyFor(who.organizationId, form.id, file.name)

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not store that file — try again.' }
  }

  const attachment = await db.requestAttachment.create({
    data: {
      organizationId: who.organizationId,
      formId: form.id,
      fieldId,
      fileKey: key,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      uploadedById: who.userId,
    },
    select: { id: true, fileName: true },
  })

  return { ok: true, data: attachment }
}
