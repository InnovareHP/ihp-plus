'use client'

import { useIsMutating, useMutation } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { uploadBulletinImage } from '../actions'
import { bulletinEvents } from '../events'

const UPLOAD_KEY = ['bulletin', 'image-upload'] as const

// Not optimistic: there is nothing to show until the bytes are stored and the photo has an id.
export function useUploadBulletinImage() {
  return useMutation({
    mutationKey: UPLOAD_KEY,
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.set('file', file)
      const result = await uploadBulletinImage(form)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    onSuccess: () => track(bulletinEvents.imageUploaded),
    onError: (error: Error) => track(bulletinEvents.imageUploadFailed, { reason: error.message }),
  })
}

/** How many photos are still on their way up, so the composer can hold a tile for each. */
export function useUploadingImageCount() {
  return useIsMutating({ mutationKey: UPLOAD_KEY })
}
