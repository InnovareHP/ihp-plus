'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { commentFormSchema, type CommentFormValues } from '../schema'

export interface ReplyComposerProps {
  onReply: (values: CommentFormValues) => Promise<void>
}

export function ReplyComposer({ onReply }: ReplyComposerProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '' },
  })

  async function submit(values: CommentFormValues) {
    try {
      await onReply(values)
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
        <Textarea
          {...register('body')}
          label="Write a reply"
          autosize
          minRows={1}
          maxRows={6}
          style={{ flex: 1 }}
          error={errors.body?.message}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              void handleSubmit(submit)()
            }
          }}
        />
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reply'}
        </Button>
      </Group>
    </form>
  )
}
