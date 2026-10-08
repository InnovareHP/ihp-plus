'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  FileButton,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTaskLists } from '../hooks/use-task-projects'
import {
  attachmentProblem,
  taskFormSchema,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskFormInput,
  type TaskFormValues,
  type TaskListRow,
} from '../schema'
import { StagedFileChip } from './staged-file-chip'

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: TASK_PRIORITY_LABELS[priority],
}))

export interface TaskFormProps {
  lists: readonly TaskListRow[]
  /**
   * Given on a board spanning every project: the form then asks which project, and offers that
   * project's lists in place of `lists`. Editing keeps the task in its project.
   */
  projects?: readonly { value: string; label: string }[]
  /** The task already exists, so its project is shown but cannot change. */
  projectLocked?: boolean
  people: readonly { value: string; label: string }[]
  defaults: TaskFormValues
  submitLabel: string
  /** The files go up once the task exists, so they travel with the values rather than alone. */
  onSave: (values: TaskFormValues, files: readonly File[]) => Promise<void>
  onClose: () => void
}

export function TaskForm({
  lists,
  projects,
  projectLocked = false,
  people,
  defaults,
  submitLabel,
  onSave,
  onClose,
}: TaskFormProps) {
  // Held, not uploaded: a file belongs to its task, so nothing is stored until one exists.
  const [staged, setStaged] = useState<File[]>([])

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  const pickedProjectId = useWatch({ control, name: 'projectId' })
  const pickedLists = useTaskLists(projects ? pickedProjectId || undefined : undefined)
  const listOptions = projects ? (pickedLists.data ?? []) : lists
  const noLists = Boolean(
    projects && pickedProjectId && pickedLists.isSuccess && listOptions.length === 0,
  )

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

  async function onSubmit(values: TaskFormValues) {
    try {
      await onSave(values, staged)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save this task.',
      })
      return
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert color="red" role="alert">
            {errors.root.message}
          </Alert>
        ) : null}

        <TextInput
          {...register('name')}
          label="What has to be done"
          placeholder="Draft the onboarding packet"
          required
          error={errors.name?.message}
          autoComplete="off"
        />

        <Textarea
          {...register('description')}
          label="Details"
          placeholder="Anything the person picking this up needs to know"
          description="Anything the person picking this up needs to know."
          minRows={3}
          autosize
          error={errors.description?.message}
        />

        {projects ? (
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <Select
                label="Project"
                placeholder="Choose a project"
                required
                data={projects}
                value={field.value || null}
                onChange={(value) => {
                  field.onChange(value ?? '')
                  // A list belongs to one project, so a new project starts the choice over.
                  setValue('listId', '')
                }}
                onBlur={field.onBlur}
                error={errors.projectId?.message}
                allowDeselect={false}
                searchable={projects.length > 8}
                disabled={projectLocked}
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="listId"
          render={({ field }) => (
            <Select
              label="List"
              placeholder={
                projects && !pickedProjectId
                  ? 'Choose a project first'
                  : pickedLists.isFetching
                    ? 'Loading lists…'
                    : 'Choose a list'
              }
              required
              disabled={Boolean(projects && !pickedProjectId)}
              description={
                noLists ? 'This project has no lists yet — add one with New list.' : undefined
              }
              data={listOptions.map((list) => ({ value: list.id, label: list.name }))}
              value={field.value}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              error={errors.listId?.message}
              allowDeselect={false}
            />
          )}
        />

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                label="Priority"
                placeholder="Choose a priority"
                data={PRIORITY_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? 'normal')}
                onBlur={field.onBlur}
                error={errors.priority?.message}
                allowDeselect={false}
              />
            )}
          />

          <TextInput
            {...register('startDate')}
            type="date"
            label="Start date"
            placeholder="mm/dd/yyyy"
            error={errors.startDate?.message}
            errorProps={{ role: 'alert' }}
          />

          <TextInput
            {...register('dueDate')}
            type="date"
            label="Due date"
            placeholder="mm/dd/yyyy"
            error={errors.dueDate?.message}
            errorProps={{ role: 'alert' }}
          />
        </Group>

        <Controller
          control={control}
          name="assigneeIds"
          render={({ field }) => (
            <MultiSelect
              label="Assigned to"
              placeholder="Pick teammates"
              description="Leave empty and the task sits in the unassigned filter."
              data={people}
              value={field.value ?? []}
              onChange={field.onChange}
              onBlur={field.onBlur}
              searchable
              error={errors.assigneeIds?.message}
            />
          )}
        />

        <Stack gap="xs">
          <Group gap="sm" align="center">
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
            <Text size="xs" c="dimmed">
              Images and documents up to 25 MB. They upload once the task is saved.
            </Text>
          </Group>

          {staged.length > 0 ? (
            <Group gap="xs">
              {staged.map((file, index) => (
                <StagedFileChip
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => setStaged((files) => files.filter((_, at) => at !== index))}
                />
              ))}
            </Group>
          ) : null}
        </Stack>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
