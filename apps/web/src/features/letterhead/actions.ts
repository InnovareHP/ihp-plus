'use server'

import { db } from '@ihp/db'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { APPLICABLE_TEMPLATES, letterheadFileProblem, stampedFileName } from './schema'
import { applyLetterhead, LetterheadError } from './utils/letterhead'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

export interface StampedFile {
  fileName: string
  contentType: string
  bytes: Uint8Array
}

async function organizationName(organizationId: string | undefined) {
  if (!organizationId) return ''
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? ''
}

/** Stamps the letterhead on a file and hands it straight back; nothing is stored. */
export async function applyLetterheadToFile(formData: FormData): Promise<Result<StampedFile>> {
  const { profile } = await requireOnboarded()

  const template = APPLICABLE_TEMPLATES.find((value) => value === formData.get('template'))
  if (!template) return { ok: false, message: 'Choose a letterhead.' }

  const file = formData.get('file')
  if (!(file instanceof File))
    return { ok: false, message: 'Choose a file to put the letterhead on.' }
  const problem = letterheadFileProblem(file)
  if (problem) return { ok: false, message: problem }

  try {
    const bytes = await applyLetterhead({
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      template,
      organizationName: await organizationName(membershipOf(profile).organizationId),
    })
    return {
      ok: true,
      data: { fileName: stampedFileName(file.name), contentType: file.type, bytes },
    }
  } catch (error) {
    if (error instanceof LetterheadError) return { ok: false, message: error.message }
    throw error
  }
}
