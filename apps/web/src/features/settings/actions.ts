'use server'

import { db } from '@ihp/db'
import { requireSession } from '@/lib/auth-guard'
import { deleteObject } from '@/lib/s3'
import { contactDetailsSchema, type ContactDetailsField } from './schema'

export type UpdateContactDetailsResult =
  { ok: true } | { ok: false; message: string; field?: ContactDetailsField }

const FIELDS: readonly string[] = ['preferredName', 'phone', 'photoKey']

function fieldOf(path: readonly PropertyKey[] | undefined): ContactDetailsField | undefined {
  const first = path?.[0]
  return typeof first === 'string' && FIELDS.includes(first)
    ? (first as ContactDetailsField)
    : undefined
}

// This parse is the trust boundary; the same schema on the client only shapes the UX.
export async function updateContactDetails(input: unknown): Promise<UpdateContactDetailsResult> {
  const session = await requireSession()
  const parsed = contactDetailsSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      message: issue?.message ?? 'Check the highlighted fields.',
      field: fieldOf(issue?.path),
    }
  }

  const values = parsed.data
  const prefix = `users/${session.user.id}/`

  // The key is client input, so it may only point at an object this person uploaded.
  if (!values.photoKey.startsWith(prefix)) {
    return {
      ok: false,
      message: 'That photo could not be used. Upload it again.',
      field: 'photoKey',
    }
  }

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { photoKey: true },
  })

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferredName: values.preferredName === '' ? null : values.preferredName,
        phone: values.phone === '' ? null : values.phone,
        photoKey: values.photoKey,
      },
    })
  } catch {
    return {
      ok: false,
      message: 'Could not save your details. Check your connection and try again.',
    }
  }

  // Removed only after the save, so a failed or abandoned edit never loses the photo on file.
  const previous = current?.photoKey
  if (previous && previous !== values.photoKey && previous.startsWith(prefix)) {
    await deleteObject(previous).catch(() => undefined)
  }

  return { ok: true }
}
