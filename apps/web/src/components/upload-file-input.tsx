'use client'

import { FileInput, Loader, Stack, Text } from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import type { UseMutationResult } from '@tanstack/react-query'
import { ACCEPTED_EXTENSIONS } from '@/features/bluebook/schema'

export interface UploadedFileRef {
  id: string
  fileName: string
}

export interface UploadFileInputProps {
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  /** The uploaded file's id, or empty while nothing is attached. */
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | undefined
  /** What the stored file travels with, named in the "uploaded" line. */
  sentWith: string
  upload: UseMutationResult<UploadedFileRef, Error, File>
}

// Uploads the moment a file is picked, so sending the form only has to claim it.
export function UploadFileInput({
  label,
  description,
  placeholder,
  required = false,
  value,
  onChange,
  onBlur,
  error,
  sentWith,
  upload,
}: UploadFileInputProps) {
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
        label={label}
        description={description || 'A PDF, Office document, text file or image, up to 25 MB.'}
        placeholder={placeholder || 'Choose a file'}
        // A button takes no aria-required, so the submit check names a missing file instead.
        withAsterisk={required}
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
        {upload.isPending ? 'Uploading…' : value ? `Uploaded — it is sent with ${sentWith}.` : ''}
      </Text>
    </Stack>
  )
}
