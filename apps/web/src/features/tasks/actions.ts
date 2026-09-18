'use server'

import { db } from '@ihp/db'
import { recordActivity } from '@/lib/activity'
import { getSession, membershipOf, readProfile } from '@/lib/auth-guard'
import { putObject, S3NotConfiguredError } from '@/lib/s3'
import { attachmentProblem, type TaskAttachmentRow } from './schema'

export type UploadResult = { ok: true; data: TaskAttachmentRow } | { ok: false; message: string }

const NO_STORAGE = 'File storage is not configured yet — tell an admin to set the S3 variables.'

// A server action rather than an RPC: Connect would carry the bytes as base64 through the same
// nginx body limit, for no gain over the multipart upload the platform already does.
async function caller() {
  const session = await getSession()
  if (!session) return null

  const profile = await readProfile(session.user.id)
  if (!profile) return null

  const membership = membershipOf(profile)
  if (!membership.organizationId) return null

  return {
    userId: session.user.id,
    name: profile.preferredName ?? session.user.name,
    organizationId: membership.organizationId,
  }
}

/** A safe object key: the original name is kept for the download, not for storage. */
function keyFor(organizationId: string, taskId: string, fileName: string) {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `tasks/${organizationId}/${taskId}/${crypto.randomUUID()}-${safe.slice(-80)}`
}

/**
 * Uploaded before the comment it belongs to exists, so the row lands unclaimed on the task and
 * posting moves it onto the comment. A file nobody posts is still the task's, which is what a
 * drop onto the task's own attachments panel means anyway.
 */
export async function uploadTaskAttachment(formData: FormData): Promise<UploadResult> {
  const who = await caller()
  if (!who) return { ok: false, message: 'Sign in to continue.' }

  const taskId = String(formData.get('taskId') ?? '')
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'Choose a file to attach.' }

  const problem = attachmentProblem(file)
  if (problem) return { ok: false, message: problem }

  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: who.organizationId },
    select: { id: true, name: true },
  })
  if (!task) return { ok: false, message: 'That task is no longer there.' }

  const key = keyFor(who.organizationId, task.id, file.name)

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    return { ok: false, message: 'Could not store that file — try again.' }
  }

  const attachment = await db.taskAttachment.create({
    data: {
      organizationId: who.organizationId,
      taskId: task.id,
      fileKey: key,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      uploadedById: who.userId,
    },
    select: { id: true, fileName: true, contentType: true, fileSize: true, createdAt: true },
  })

  await recordActivity({
    organizationId: who.organizationId,
    subjectType: 'task',
    subjectId: task.id,
    action: 'task.attached',
    actorId: who.userId,
    actorName: who.name,
    detail: file.name,
  })

  return {
    ok: true,
    data: {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      fileSize: attachment.fileSize,
      // The panel refetches on settle; signing a link the composer will not open is wasted work.
      url: '',
      uploadedByName: who.name,
      createdAt: attachment.createdAt.toISOString(),
      commentId: undefined,
    },
  }
}
