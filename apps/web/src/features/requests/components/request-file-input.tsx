'use client'

import { FileInput, Loader, Stack, Text } from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { ACCEPTED_EXTENSIONS } from '@/features/bluebook/schema'
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

// Uploads the moment a file is picked, so sending the request only has to claim it.
export function RequestFileInput({
  formId,
  field,
  value,
  onChange,
  onBlur,
  error,
}: RequestFileInputProps) {
  const upload = useUploadRequestFile(formId, field.id)
  const chosen = value ? (upload.variables ?? null) : null

  function pick(file: File | null) {
    onChange('')
    if (!file) {
      upload.reset()
      return
    }
    upload.mutate(file, { onSuccess: (uploaded) => onChange(uploaded.id) })
  }

  return (
    <Stack gap={4}>
      <FileInput
        label={field.label}
        description={field.help || 'A PDF, Office document, text file or image, up to 25 MB.'}
        placeholder={field.placeholder || 'Choose a file'}
        // A button takes no aria-required, so the submit check names a missing file instead.
        withAsterisk={field.required}
        accept={ACCEPTED_EXTENSIONS}
        clearable={!upload.isPending}
        disabled={upload.isPending}
        leftSection={<IconPaperclip size={16} aria-hidden />}
        rightSection={upload.isPending ? <Loader size="xs" aria-hidden /> : undefined}
        value={upload.isPending ? (upload.variables ?? null) : chosen}
        onChange={pick}
        onBlur={onBlur}
        error={upload.error?.message ?? error}
        errorProps={{ role: 'alert' }}
      />
      <Text size="xs" c="dimmed" aria-live="polite">
        {upload.isPending ? 'Uploading…' : value ? 'Uploaded — it is sent with the request.' : ''}
      </Text>
    </Stack>
  )
}
