'use client'

import { UploadFileInput } from '@/components/upload-file-input'
import { useUploadRequestFile } from '../hooks/use-upload-request-file'
import type { FormField } from '../schema'

export interface RequestFileInputProps {
  formId: string
  field: FormField
  /** The uploaded file's id, or empty while nothing is attached. */
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | undefined
}

export function RequestFileInput({ formId, field, ...props }: RequestFileInputProps) {
  const upload = useUploadRequestFile(formId, field.id)

  return (
    <UploadFileInput
      label={field.label}
      description={field.help}
      placeholder={field.placeholder}
      required={field.required}
      sentWith="the request"
      upload={upload}
      {...props}
    />
  )
}
