'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Avatar,
  Button,
  FileInput,
  Group,
  Stack,
  Text,
  TextInput,
  VisuallyHidden,
} from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useUploadPhoto } from '@/features/onboarding/hooks/use-upload-photo'
import { ACCEPTED_PHOTO_TYPES } from '@/features/onboarding/utils/photo'
import { track } from '@/lib/analytics'
import { updateContactDetails } from '../actions'
import { settingsEvents } from '../events'
import { contactDetailsSchema, type ContactDetailsValues } from '../schema'

export interface ContactDetailsFormProps {
  defaultValues: ContactDetailsValues
  initialPhotoUrl: string | undefined
  initials: string
}

export function ContactDetailsForm({
  defaultValues,
  initialPhotoUrl,
  initials,
}: ContactDetailsFormProps) {
  const router = useRouter()
  const upload = useUploadPhoto()
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful, isDirty },
  } = useForm<ContactDetailsValues>({
    resolver: zodResolver(contactDetailsSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  const saved = isSubmitSuccessful && !isDirty && Object.keys(errors).length === 0

  function selectPhoto(file: File | null) {
    if (!file) return
    // No previous key: the photo on file must survive until the new one is actually saved.
    upload.mutate(
      { file, previousKey: '' },
      {
        onSuccess: ({ key }) =>
          setValue('photoKey', key, { shouldDirty: true, shouldValidate: true }),
      },
    )
  }

  async function onSubmit(values: ContactDetailsValues) {
    const result = await updateContactDetails(values).catch(() => ({
      ok: false as const,
      message: 'Could not reach the portal. Check your connection and try again.',
      field: undefined,
    }))

    if (!result.ok) {
      track(settingsEvents.contactDetailsSaveFailed, { reason: result.message })
      setError(result.field ?? 'root', { message: result.message })
      return
    }

    track(settingsEvents.contactDetailsSaved)
    reset(values, { keepIsSubmitSuccessful: true })
    // The ID card and the header read the profile on the server.
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not save your details" />

        <Group gap="lg" align="flex-end" wrap="nowrap">
          <Avatar
            src={upload.data?.url ?? initialPhotoUrl}
            alt=""
            size={72}
            radius="md"
            color="brand"
          >
            {initials}
          </Avatar>
          <FileInput
            label="Photo"
            description="JPEG, PNG or WebP, up to 5 MB. It is printed on your company ID."
            placeholder="Choose a new photo"
            accept={ACCEPTED_PHOTO_TYPES}
            onChange={selectPhoto}
            disabled={upload.isPending}
            error={errors.photoKey?.message ?? (upload.isError ? upload.error.message : undefined)}
            errorProps={{ role: 'alert' }}
            flex={1}
          />
        </Group>

        {/* A loading indicator is invisible to a screen reader, so upload state is announced. */}
        <VisuallyHidden aria-live="polite">
          {upload.isPending
            ? 'Uploading your photo.'
            : upload.isSuccess
              ? 'Photo uploaded. Save changes to keep it.'
              : ''}
        </VisuallyHidden>

        <TextInput
          label="Preferred name"
          description="What colleagues see in the directory and the portal header."
          autoComplete="nickname"
          error={errors.preferredName?.message}
          errorProps={{ role: 'alert' }}
          {...register('preferredName')}
        />

        <TextInput
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          errorProps={{ role: 'alert' }}
          {...register('phone')}
        />

        <Group gap="sm">
          <Button type="submit" loading={isSubmitting} disabled={upload.isPending}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
          {saved ? (
            <Text size="sm" c="dimmed" role="status">
              Saved.
            </Text>
          ) : null}
        </Group>
      </Stack>
    </form>
  )
}
