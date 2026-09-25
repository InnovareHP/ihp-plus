'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { postFormSchema, type PostFormValues } from '../schema'

export interface PostEditFormProps {
  body: string
  onCancel: () => void
  onSave: (values: PostFormValues) => Promise<void>
}

export function PostEditForm({ body, onCancel, onSave }: PostEditFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body },
  })

  async function submit(values: PostFormValues) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that — try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="sm">
        <FormError message={errors.root?.message} title="Could not save your post" />
        <Textarea
          {...register('body')}
          label="Edit your post"
          autosize
          minRows={2}
          maxRows={12}
          required
          error={errors.body?.message}
          // The form opened because the user asked to edit, so the caret belongs in it.
          data-autofocus
          autoFocus
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
