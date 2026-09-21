'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useCreateProject, useUpdateProject } from '../hooks/use-task-projects'
import {
  projectFormSchema,
  type ProjectFormInput,
  type ProjectFormValues,
  type TaskProjectRow,
} from '../schema'

export interface ProjectFormModalProps {
  opened: boolean
  /** Set when an existing project is being renamed rather than a new one created. */
  project?: TaskProjectRow | null
  onClose: () => void
  /** The board switches to whatever was just created. */
  onCreated: (projectId: string) => void
}

export function ProjectFormModal({
  opened,
  project = null,
  onClose,
  onCreated,
}: ProjectFormModalProps) {
  const create = useCreateProject()
  const update = useUpdateProject()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: { name: project?.name ?? '', color: project?.color ?? '' },
  })

  async function onSubmit(values: ProjectFormValues) {
    try {
      if (project) {
        await update.mutateAsync({ projectId: project.id, name: values.name, color: values.color })
      } else {
        const created = await create.mutateAsync(values)
        onCreated(created.id)
      }
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save the project.',
      })
      return
    }
    reset({ name: '', color: '' })
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={project ? 'Rename project' : 'New project'}
      centered
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            {...register('name')}
            label="Project name"
            description="A project starts with one list; add more once the work splits."
            placeholder="Onboarding revamp"
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
              {isSubmitting ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
