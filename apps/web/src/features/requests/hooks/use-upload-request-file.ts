'use client'

import { useMutation } from '@tanstack/react-query'
import { fileProblem } from '@/features/bluebook/schema'
import { track } from '@/lib/analytics'
import { uploadRequestFile } from '../actions'
import { requestEvents } from '../events'
import type { UploadedFile } from '../schema'

// Not optimistic: nothing is cached until the request is sent, and the id comes from the server.
export function useUploadRequestFile(formId: string, fieldId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedFile> => {
      // Checked here too, so a wrong file is refused before its bytes cross the network.
      const problem = fileProblem(file)
      if (problem) throw new Error(problem)

      const body = new FormData()
      body.set('formId', formId)
      body.set('fieldId', fieldId)
      body.set('file', file)

      const result = await uploadRequestFile(body)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(requestEvents.fileUploaded, { formId }),
    onError: (error: Error) =>
      track(requestEvents.fileUploadFailed, { formId, reason: error.message }),
  })
}
