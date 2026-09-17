'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useCreateProject } from '../hooks/use-task-projects'
import { projectFormSchema, type ProjectFormInput, type ProjectFormValues } from '../schema'

export interface ProjectFormModalProps {
  opened: boolean
  onClose: () => void
  /** The board switches to whatever was just created. */
  onCreated: (projectId: string) => void
}

export function ProjectFormModal({ opened, onClose, onCreated }: ProjectFormModalProps) {
  const create = useCreateProject()
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
    defaultValues: { name: '', color: '' },
  })

  async function onSubmit(values: ProjectFormValues) {
    try {
      const project = await create.mutateAsync(values)
      onCreated(project.id)
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not create the project.',
      })
      return
    }
    reset({ name: '', color: '' })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New project" centered>
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
              {isSubmitting ? 'Creating…' : 'Create project'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
