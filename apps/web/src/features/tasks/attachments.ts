'use client'

import { uploadTaskAttachment } from './actions'
import { deleteAttachment } from './rpc'

/** Stored one at a time: the first refusal stops the rest rather than filling the bucket. */
export async function storeFiles(taskId: string, files: readonly File[]): Promise<string[]> {
  const stored: string[] = []

  for (const file of files) {
    const body = new FormData()
    body.set('taskId', taskId)
    body.set('file', file)

    const result = await uploadTaskAttachment(body)
    if (!result.ok) {
      await Promise.all(stored.map((id) => deleteAttachment(id).catch(() => undefined)))
      throw new Error(result.message)
    }
    stored.push(result.data.id)
  }

  return stored
}
