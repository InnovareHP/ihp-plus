'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Textarea } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormError } from '@/components/form-error'
import {
  commentEditSchema,
  type CommentEditValues,
  type TaskAssigneeRef,
  type TaskCommentRow,
} from '../schema'
import { isSubmitShortcut } from '../utils/submit-shortcut'
import { NotifySelect } from './notify-select'

export interface CommentEditFormProps {
  comment: TaskCommentRow
  colleagues: readonly TaskAssigneeRef[]
  onCancel: () => void
  onSave: (values: CommentEditValues) => Promise<void>
}

export function CommentEditForm({ comment, colleagues, onCancel, onSave }: CommentEditFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof commentEditSchema>, unknown, CommentEditValues>({
    resolver: zodResolver(commentEditSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      body: comment.body,
      mentionUserIds: comment.mentions.map((person) => person.userId),
    },
  })

  async function submit(values: CommentEditValues) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that change.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="xs">
        <FormError message={errors.root?.message} title="Could not save your comment" />

        <Textarea
          {...register('body')}
          label="Edit your comment"
          description="⌘/Ctrl + Enter saves, Escape cancels."
          autosize
          minRows={2}
          maxRows={10}
          error={errors.body?.message}
          errorProps={{ role: 'alert' }}
          onKeyDown={(event) => {
            if (isSubmitShortcut(event)) void handleSubmit(submit)()
            if (event.key === 'Escape') onCancel()
          }}
        />

        <Controller
          control={control}
          name="mentionUserIds"
          render={({ field }) => (
            <NotifySelect
              colleagues={colleagues}
              value={field.value ?? []}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />

        <Group gap="xs">
          <Button type="submit" size="xs" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" size="xs" variant="subtle" color="gray" onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
