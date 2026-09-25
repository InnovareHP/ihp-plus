'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Divider,
  FileButton,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core'
import { IconPhotoPlus, IconSend, IconSpeakerphone } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useUploadBulletinImage, useUploadingImageCount } from '../hooks/use-bulletin-images'
import { bulletinImageUrl } from '../image-url'
import {
  BULLETIN_IMAGE_TYPES,
  bulletinImageProblem,
  MAX_BULLETIN_IMAGES,
  postFormSchema,
  type PostFormValues,
} from '../schema'
import { ComposerImageTile } from './composer-image-tile'
import { ImageTileSkeleton } from './image-tile-skeleton'

export interface PostComposerProps {
  onPost: (values: PostFormValues) => Promise<void>
}

export function PostComposer({ onPost }: PostComposerProps) {
  const upload = useUploadBulletinImage()
  const uploading = useUploadingImageCount()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '', imageIds: [] },
  })

  const imageIds = watch('imageIds')
  const slots = MAX_BULLETIN_IMAGES - imageIds.length - uploading

  async function addPhotos(files: File[]) {
    clearErrors('imageIds')
    if (files.length > slots) {
      setError('imageIds', {
        message: `A post can carry up to ${MAX_BULLETIN_IMAGES} photos — the extra ones were left out.`,
      })
    }

    await Promise.all(
      files.slice(0, Math.max(slots, 0)).map(async (file) => {
        const problem = bulletinImageProblem(file)
        if (problem) {
          setError('imageIds', { message: `${file.name}: ${problem}` })
          return
        }
        try {
          const image = await upload.mutateAsync(file)
          // Read at resolve time, so photos finishing in any order all land.
          setValue('imageIds', [...getValues('imageIds'), image.id], { shouldDirty: true })
        } catch (error) {
          setError('imageIds', {
            message: error instanceof Error ? error.message : 'Could not add that photo.',
          })
        }
      }),
    )
  }

  function removePhoto(imageId: string) {
    setValue(
      'imageIds',
      getValues('imageIds').filter((id) => id !== imageId),
      { shouldDirty: true },
    )
  }

  async function submit(values: PostFormValues) {
    try {
      await onPost(values)
      reset()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not post that — try again.',
      })
    }
  }

  const busy = isSubmitting || uploading > 0

  return (
    <Paper withBorder radius="lg" p="lg" shadow="xs">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Group align="flex-start" wrap="nowrap" gap="md">
          <ThemeIcon size={44} radius="xl" variant="light" visibleFrom="xs" aria-hidden>
            <IconSpeakerphone size={22} />
          </ThemeIcon>
          <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
            <FormError message={errors.root?.message} title="Could not post to the board" />
            <Textarea
              {...register('body')}
              label="Share an update"
              description="Everyone in the company sees it, and can react or reply."
              placeholder="Company news, a welcome, or a thank-you."
              variant="filled"
              radius="md"
              autosize
              minRows={3}
              maxRows={12}
              error={errors.body?.message}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  void handleSubmit(submit)()
                }
              }}
            />

            {imageIds.length + uploading > 0 ? (
              <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs" component="ul" p={0} m={0}>
                {imageIds.map((id, index) => (
                  <ComposerImageTile
                    key={id}
                    url={bulletinImageUrl(id)}
                    label={`Photo ${index + 1}`}
                    onRemove={() => removePhoto(id)}
                  />
                ))}
                {Array.from({ length: uploading }, (_, index) => (
                  <ImageTileSkeleton key={`uploading-${index}`} />
                ))}
              </SimpleGrid>
            ) : null}

            {errors.imageIds?.message ? (
              <Text size="sm" c="red" role="alert">
                {errors.imageIds.message}
              </Text>
            ) : null}

            <Divider />

            <Group justify="space-between" gap="sm" wrap="wrap">
              <Group gap="xs" wrap="nowrap">
                <FileButton
                  onChange={(files) => void addPhotos(files)}
                  accept={BULLETIN_IMAGE_TYPES.join(',')}
                  multiple
                  disabled={slots <= 0 || isSubmitting}
                >
                  {(props) => (
                    <Button
                      {...props}
                      variant="subtle"
                      leftSection={<IconPhotoPlus size={18} aria-hidden />}
                    >
                      Add photos
                    </Button>
                  )}
                </FileButton>
                <Text size="xs" c="dimmed">
                  {imageIds.length} of {MAX_BULLETIN_IMAGES}
                </Text>
              </Group>
              <Button
                type="submit"
                radius="xl"
                loading={busy}
                leftSection={<IconSend size={16} aria-hidden />}
              >
                {uploading > 0 ? 'Uploading…' : isSubmitting ? 'Posting…' : 'Post'}
              </Button>
            </Group>
          </Stack>
        </Group>
      </form>
    </Paper>
  )
}
