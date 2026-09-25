'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Group } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { MentionTextarea } from '@/components/mention-textarea'
import type { MentionPerson } from '@/lib/mentions'
import { commentFormSchema, type CommentFormValues } from '../schema'
import { keepMentionedIds } from '../utils/mentions'

export interface ReplyComposerProps {
  people: readonly MentionPerson[]
  onReply: (values: CommentFormValues) => Promise<void>
}

export function ReplyComposer({ people, onReply }: ReplyComposerProps) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '', mentionUserIds: [] },
  })

  async function submit(values: CommentFormValues) {
    try {
      await onReply({
        ...values,
        mentionUserIds: keepMentionedIds(values.body, values.mentionUserIds, people),
      })
      reset()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send that — try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <FormError message={errors.root?.message} title="Could not send your reply" />
      {/* A single-field inline add, so the button meets the input whatever the label does. */}
      <Group align="flex-end" gap="xs" wrap="nowrap" mt={errors.root ? 'sm' : 0}>
        <Box flex={1} miw={0}>
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <MentionTextarea
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                onMention={(userId) => {
                  const picked = getValues('mentionUserIds')
                  if (!picked.includes(userId)) setValue('mentionUserIds', [...picked, userId])
                }}
                colleagues={people}
                allowEveryone={false}
                label="Write a reply"
                placeholder="Type @ to mention someone."
                minRows={1}
                maxRows={6}
                error={errors.body?.message}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    void handleSubmit(submit)()
                  }
                }}
              />
            )}
          />
        </Box>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reply'}
        </Button>
      </Group>
    </form>
  )
}
