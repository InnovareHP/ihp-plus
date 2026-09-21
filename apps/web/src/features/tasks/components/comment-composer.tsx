'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileButton, Group, Stack, Text, Textarea } from '@mantine/core'
import { IconPaperclip, IconSend } from '@tabler/icons-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormError } from '@/components/form-error'
import {
  attachmentProblem,
  commentFormSchema,
  type CommentFormValues,
  type TaskAssigneeRef,
} from '../schema'
import { isSubmitShortcut } from '../utils/submit-shortcut'
import { NotifySelect } from './notify-select'
import { StagedFileChip } from './staged-file-chip'

export interface CommentComposerProps {
  colleagues: readonly TaskAssigneeRef[]
  isPosting: boolean
  onPost: (values: { body: string; mentionUserIds: string[]; files: File[] }) => Promise<void>
}

export function CommentComposer({ colleagues, isPosting, onPost }: CommentComposerProps) {
  // Held here, not uploaded: a file belongs to its comment, so nothing is stored until the
  // comment is posted and a composer the user walks away from leaves nothing behind.
  const [staged, setStaged] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof commentFormSchema>, unknown, CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '', mentionUserIds: [], attachmentIds: [] },
  })

  // The same rule the action enforces, said before the bytes travel rather than after.
  function attach(file: File | null) {
    if (!file) return

    const problem = attachmentProblem(file)
    if (problem) {
      setError('root', { message: problem })
      return
    }

    setError('root', { message: '' })
    setStaged((files) => [...files, file])
  }

  async function submit(values: CommentFormValues) {
    try {
      await onPost({ body: values.body, mentionUserIds: values.mentionUserIds, files: staged })
      reset()
      setStaged([])
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Could not post that.' })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="sm">
        <FormError message={errors.root?.message} title="Could not post your comment" />

        <Textarea
          {...register('body')}
          label="Add a comment"
          description="⌘/Ctrl + Enter posts it."
          placeholder="Ask a question, or say what changed."
          autosize
          minRows={3}
          maxRows={10}
          error={errors.body?.message}
          errorProps={{ role: 'alert' }}
          onKeyDown={(event) => {
            if (isSubmitShortcut(event)) void handleSubmit(submit)()
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

        {staged.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Attached to this comment
            </Text>
            {staged.map((file) => (
              <StagedFileChip
                key={`${file.name}-${file.lastModified}`}
                file={file}
                onRemove={(one) => setStaged((files) => files.filter((each) => each !== one))}
              />
            ))}
          </Stack>
        ) : null}

        <Group justify="space-between">
          <FileButton onChange={attach}>
            {(props) => (
              <Button
                {...props}
                type="button"
                variant="default"
                leftSection={<IconPaperclip size={16} aria-hidden />}
              >
                Attach a file
              </Button>
            )}
          </FileButton>

          <Button
            type="submit"
            loading={isSubmitting || isPosting}
            leftSection={<IconSend size={16} aria-hidden />}
          >
            {isSubmitting || isPosting ? 'Posting…' : 'Post comment'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
