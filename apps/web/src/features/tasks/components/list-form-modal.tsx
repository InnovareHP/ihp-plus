'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useCreateList } from '../hooks/use-task-projects'
import { listFormSchema, type ListFormValues } from '../schema'

export interface ListFormModalProps {
  opened: boolean
  onClose: () => void
  projectId: string
}

export function ListFormModal({ opened, onClose, projectId }: ListFormModalProps) {
  const create = useCreateList()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: { projectId, name: '' },
  })

  async function onSubmit(values: ListFormValues) {
    try {
      await create.mutateAsync(values)
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not create the list.',
      })
      return
    }
    reset({ projectId, name: '' })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New list" centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            {...register('name')}
            label="List name"
            placeholder="This week"
            required
            aria-required="true"
            error={errors.name?.message}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create list'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
