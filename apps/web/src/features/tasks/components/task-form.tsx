'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Group,
  MultiSelect,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  taskFormSchema,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskFormInput,
  type TaskFormValues,
  type TaskListRow,
} from '../schema'

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: TASK_PRIORITY_LABELS[priority],
}))

export interface TaskFormProps {
  lists: readonly TaskListRow[]
  people: readonly { value: string; label: string }[]
  defaults: TaskFormValues
  submitLabel: string
  onSave: (values: TaskFormValues) => Promise<void>
  onClose: () => void
}

export function TaskForm({ lists, people, defaults, submitLabel, onSave, onClose }: TaskFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: TaskFormValues) {
    try {
      await onSave(values)
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

        <Controller
          control={control}
          name="listId"
          render={({ field }) => (
            <Select
              label="List"
              placeholder="Choose a list"
              required
              data={lists.map((list) => ({ value: list.id, label: list.name }))}
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
            {...register('dueDate')}
            type="date"
            label="Due date"
            placeholder="mm/dd/yyyy"
            error={errors.dueDate?.message}
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
