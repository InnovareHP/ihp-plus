'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileButton, Group, Stack, Text, Textarea } from '@mantine/core'
import { IconPaperclip, IconSend } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormError } from '@/components/form-error'
import {
  commentFormSchema,
  type CommentFormValues,
  type TaskAssigneeRef,
  type TaskAttachmentRow,
} from '../schema'
import { AttachmentChip } from './attachment-chip'
import { MentionPicker } from './mention-picker'

export interface CommentComposerProps {
  colleagues: readonly TaskAssigneeRef[]
  isPosting: boolean
  isUploading: boolean
  onUpload: (file: File) => Promise<TaskAttachmentRow | undefined>
  onPost: (values: {
    body: string
    mentionUserIds: string[]
    attachments: TaskAttachmentRow[]
  }) => Promise<void>
}

export function CommentComposer({
  colleagues,
  isPosting,
  isUploading,
  onUpload,
  onPost,
}: CommentComposerProps) {
  // Files exist on the server before the comment does, so they are held here until it posts.
  const [pending, setPending] = useState<TaskAttachmentRow[]>([])
  const [mentioned, setMentioned] = useState<TaskAssigneeRef[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof commentFormSchema>, unknown, CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '', mentionUserIds: [], attachmentIds: [] },
  })

  const body = watch('body')

  function mention(person: TaskAssigneeRef) {
    if (mentioned.some((one) => one.userId === person.userId)) return
    const next = [...mentioned, person]
    setMentioned(next)
    setValue('body', `${body ? `${body.replace(/\s*$/, '')} ` : ''}@${person.name} `, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(
      'mentionUserIds',
      next.map((one) => one.userId),
    )
  }

  async function attach(file: File | null) {
    if (!file) return
    const stored = await onUpload(file)
    if (!stored) return
    setPending((files) => [...files, stored])
  }

  async function submit(values: CommentFormValues) {
    try {
      await onPost({
        body: values.body,
        // Only the people still named in the body are notified, so deleting the @ undoes it.
        mentionUserIds: mentioned
          .filter((person) => values.body.includes(`@${person.name}`))
          .map((person) => person.userId),
        attachments: pending,
      })
      reset()
      setPending([])
      setMentioned([])
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
          placeholder="Ask a question, or say what changed."
          autosize
          minRows={3}
          maxRows={10}
          error={errors.body?.message}
          errorProps={{ role: 'alert' }}
        />

        <MentionPicker colleagues={colleagues} onPick={mention} />

        {pending.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Attached to this comment
            </Text>
            {pending.map((file) => (
              <AttachmentChip
                key={file.id}
                file={file}
                onRemove={() => setPending((files) => files.filter((one) => one.id !== file.id))}
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
                loading={isUploading}
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
