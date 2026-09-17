'use client'

import { useMutation } from '@tanstack/react-query'
import { uploadPhoto } from '../actions'

export interface UploadPhotoInput {
  file: File
  previousKey: string
}

// Runs on selection rather than on submit so a slow upload never blocks the finish button.
export function useUploadPhoto() {
  return useMutation({
    mutationFn: async ({ file, previousKey }: UploadPhotoInput) => {
      const formData = new FormData()
      formData.set('photo', file)
      formData.set('previousKey', previousKey)

      const result = await uploadPhoto(formData)
      if (!result.ok) throw new Error(result.message)
      return { key: result.key, url: result.url }
    },
  })
}
