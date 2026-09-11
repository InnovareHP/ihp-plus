'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useCreateTeam } from '../hooks/use-teams'
import { createTeamSchema, type CreateTeamValues } from '../schema'

export function CreateTeamModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const create = useCreateTeam()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamValues>({
    resolver: zodResolver(createTeamSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: '' },
  })

  async function onSubmit(values: CreateTeamValues) {
    try {
      await create.mutateAsync(values)
    } catch (error) {
      setError('name', { message: error instanceof Error ? error.message : 'Could not create.' })
      return
    }
    reset({ name: '' })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New department" centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            {...register('name')}
            label="Department name"
            placeholder="Clinical Operations"
            required
            aria-required="true"
            error={errors.name?.message}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create department'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
