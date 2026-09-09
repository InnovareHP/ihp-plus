'use client'

import { Alert, Avatar, FileInput, Group, Stack, Text, VisuallyHidden } from '@mantine/core'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { ACCEPTED_PHOTO_TYPES } from '../photo'
import type { OnboardingValues } from '../schema'
import { useUploadPhoto } from '../use-upload-photo'

const PHOTO_ERROR_ID = 'onboarding-photo-error'

export interface PhotoStepProps {
  form: UseFormReturn<OnboardingValues>
  initialPhotoUrl: string | undefined
}

export function PhotoStep({ form, initialPhotoUrl }: PhotoStepProps) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = form
  const upload = useUploadPhoto()
  const [firstName, lastName] = useWatch({ control, name: ['firstName', 'lastName'] })

  const initials = [firstName, lastName]
    .map((part) => part?.trim().charAt(0).toUpperCase() ?? '')
    .join('')
  const previewUrl = upload.data?.url ?? initialPhotoUrl
  const fieldError = errors.photoKey?.message
  const uploadError = upload.isError ? upload.error.message : undefined

  function handleSelect(file: File | null) {
    if (!file) return
    upload.mutate(
      { file, previousKey: getValues('photoKey') },
      { onSuccess: ({ key }) => setValue('photoKey', key, { shouldValidate: true }) },
    )
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        This photo is printed on your IHP company ID, so use a clear head-and-shoulders shot on a
        plain background.
      </Text>

      <Group gap="lg" align="center" wrap="nowrap">
        <Avatar src={previewUrl} alt="" size={96} radius="md" color="brand">
          {initials}
        </Avatar>
        {previewUrl ? (
          <Text size="sm" c="dimmed">
            This is the photo on file.
          </Text>
        ) : null}
      </Group>

      {/* A loading indicator is invisible to a screen reader, so upload state is announced too. */}
      <VisuallyHidden aria-live="polite">
        {upload.isPending ? 'Uploading your photo' : previewUrl ? 'Photo uploaded' : ''}
      </VisuallyHidden>

      {/*
        FileInput's visible control is a button, where aria-required and aria-invalid are invalid
        ARIA, so the requirement is announced through the description instead of aria-required.
      */}
      <FileInput
        label={previewUrl ? 'Replace photo' : 'Photo'}
        description="Required. JPEG, PNG or WebP, up to 5 MB."
        placeholder="Choose an image"
        accept={ACCEPTED_PHOTO_TYPES}
        fileInputProps={{ 'aria-label': 'Photo file' }}
        value={upload.variables?.file ?? null}
        onChange={handleSelect}
        loading={upload.isPending}
        disabled={upload.isPending}
        required
        aria-describedby={fieldError ? PHOTO_ERROR_ID : undefined}
        error={Boolean(fieldError)}
      />

      {fieldError ? (
        <Text id={PHOTO_ERROR_ID} role="alert" size="sm" c="red.7">
          {fieldError}
        </Text>
      ) : null}

      {uploadError ? (
        <Alert role="alert" color="red" variant="light" title="Upload failed">
          {uploadError}
        </Alert>
      ) : null}
    </Stack>
  )
}
