'use client'

import { UploadFileInput } from '@/components/upload-file-input'
import { useUploadApplicationFile } from '../hooks/use-apply'

export interface ApplicationFileInputProps {
  slug: string
  fieldId: string
  label: string
  description?: string
  placeholder?: string
  required: boolean
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | undefined
}

export function ApplicationFileInput({ slug, fieldId, ...props }: ApplicationFileInputProps) {
  const upload = useUploadApplicationFile(slug, fieldId)
  return <UploadFileInput sentWith="your application" upload={upload} {...props} />
}
