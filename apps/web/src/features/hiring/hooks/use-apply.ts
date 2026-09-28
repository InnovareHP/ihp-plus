'use client'

import { useMutation } from '@tanstack/react-query'
import { fileProblem } from '@/features/bluebook/schema'
import { track } from '@/lib/analytics'
import type { UploadedFile } from '@/features/requests/schema'
import { hiringEvents } from '../events'
import { submitApplication, uploadApplicationFile, withdrawApplication } from '../public-actions'
import type { ApplicationSubmission } from '../schema'

// Not optimistic: nothing is cached until the application is sent, and the id comes from the server.
export function useUploadApplicationFile(slug: string, fieldId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedFile> => {
      // Checked here too, so a wrong file is refused before its bytes cross the network.
      const problem = fileProblem(file)
      if (problem) throw new Error(problem)

      const body = new FormData()
      body.set('slug', slug)
      body.set('fieldId', fieldId)
      body.set('file', file)

      const result = await uploadApplicationFile(body)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(hiringEvents.fileUploaded, { fieldId }),
    onError: (error: Error) =>
      track(hiringEvents.fileUploadFailed, { fieldId, reason: error.message }),
  })
}

// Not optimistic: success is a new page, the applicant's status link, which only the server can sign.
export function useSubmitApplication() {
  return useMutation({
    mutationFn: async (submission: ApplicationSubmission) => {
      const result = await submitApplication(submission)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(hiringEvents.applied),
    onError: (error: Error) => track(hiringEvents.applyFailed, { reason: error.message }),
  })
}

export function useWithdrawApplication() {
  return useMutation({
    mutationFn: async (link: { applicationId: string; signature: string }) => {
      const result = await withdrawApplication(link)
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => track(hiringEvents.withdrawn),
    onError: (error: Error) => track(hiringEvents.withdrawFailed, { reason: error.message }),
  })
}
