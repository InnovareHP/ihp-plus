'use client'

import { useMutation } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { applyLetterheadToFile, type StampedFile } from './actions'
import { letterheadEvents } from './events'
import type { ApplyLetterheadValues } from './schema'

// No cache to touch: the stamped file goes straight to the browser and is never stored.
export function useApplyLetterhead() {
  return useMutation({
    mutationFn: async (values: ApplyLetterheadValues): Promise<StampedFile> => {
      const formData = new FormData()
      formData.set('template', values.template)
      if (values.file) formData.set('file', values.file)
      const result = await applyLetterheadToFile(formData)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: (_data, values) =>
      track(letterheadEvents.applied, { template: values.template, type: values.file?.type ?? '' }),
    onError: (error: Error, values) =>
      track(letterheadEvents.applyFailed, { template: values.template, reason: error.message }),
  })
}
