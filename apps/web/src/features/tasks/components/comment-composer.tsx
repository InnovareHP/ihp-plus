'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileButton, Group, Stack, Text } from '@mantine/core'
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
import { MentionTextarea } from './mention-textarea'
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
  const [isOver, setOver] = useState(false)

  const {
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
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
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      // Dropping is the shortcut; the Attach button stays the keyboard path.
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        for (const file of Array.from(event.dataTransfer?.files ?? [])) attach(file)
      }}
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        outline: isOver ? '2px dashed var(--mantine-color-brand-filled)' : undefined,
        outlineOffset: 4,
      }}
    >
      <Stack gap="sm">
        {isOver ? (
          <Text size="sm" c="dimmed">
            Drop to attach to this comment.
          </Text>
        ) : null}
        <FormError message={errors.root?.message} title="Could not post your comment" />

        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <MentionTextarea
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              // A name picked from the list is also somebody to notify, which is the same field.
              onMention={(userId) => {
                const notified = getValues('mentionUserIds') ?? []
                if (!notified.includes(userId)) {
                  setValue('mentionUserIds', [...notified, userId], { shouldDirty: true })
                }
              }}
              colleagues={colleagues}
              label="Add a comment"
              description="Type @ to mention someone. ⌘/Ctrl + Enter posts it."
              placeholder="Ask a question, or say what changed."
              error={errors.body?.message}
              onKeyDown={(event) => {
                if (isSubmitShortcut(event)) void handleSubmit(submit)()
              }}
            />
          )}
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
