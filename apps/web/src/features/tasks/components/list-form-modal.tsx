'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useCreateList, useUpdateList } from '../hooks/use-task-projects'
import { listFormSchema, type ListFormValues, type TaskListRow } from '../schema'

export interface ListFormModalProps {
  opened: boolean
  onClose: () => void
  projectId: string
  /** Set when an existing list is being renamed rather than a new one created. */
  list?: TaskListRow | null
}

export function ListFormModal({ opened, onClose, projectId, list = null }: ListFormModalProps) {
  const create = useCreateList()
  const update = useUpdateList()
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
    values: { projectId, name: list?.name ?? '' },
  })

  async function onSubmit(values: ListFormValues) {
    try {
      if (list) {
        await update.mutateAsync({ listId: list.id, name: values.name })
      } else {
        await create.mutateAsync(values)
      }
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save the list.',
      })
      return
    }
    reset({ projectId, name: '' })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={list ? 'Rename list' : 'New list'} centered>
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
              {isSubmitting ? 'Saving…' : list ? 'Save changes' : 'Create list'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
