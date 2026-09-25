'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Paper, Stack, Textarea } from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { postFormSchema, type PostFormValues } from '../schema'

export interface PostComposerProps {
  onPost: (values: PostFormValues) => Promise<void>
}

export function PostComposer({ onPost }: PostComposerProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { body: '' },
  })

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

  return (
    <Paper withBorder radius="md" p="md">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="sm">
          <FormError message={errors.root?.message} title="Could not post to the board" />
          <Textarea
            {...register('body')}
            label="Post to the board"
            description="Everyone in the company sees it, and can react or reply."
            placeholder="Share news, ask a question, or say thanks."
            autosize
            minRows={3}
            maxRows={12}
            required
            error={errors.body?.message}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                void handleSubmit(submit)()
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              type="submit"
              loading={isSubmitting}
              leftSection={<IconSend size={16} aria-hidden />}
            >
              {isSubmitting ? 'Posting…' : 'Post'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
