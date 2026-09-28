'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { noteSchema, type NoteValues } from '../schema'

export interface NoteComposerProps {
  applicationId: string
  onAdd: (values: NoteValues) => void
}

// The note is added optimistically, so the form clears at once rather than waiting on the server.
export function NoteComposer({ applicationId, onAdd }: NoteComposerProps) {
  const { register, handleSubmit, reset, formState } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { applicationId, body: '' },
  })

  function onSubmit(values: NoteValues) {
    onAdd(values)
    reset({ applicationId, body: '' })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="xs">
        <Textarea
          {...register('body')}
          label="Add a note"
          description="Only HR and admins see notes."
          autosize
          minRows={2}
          error={formState.errors.body?.message}
          errorProps={{ role: 'alert' }}
        />
        <Group justify="flex-end">
          <Button type="submit" variant="light">
            Add note
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
