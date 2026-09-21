'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Progress,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { subtaskFormSchema, type SubtaskFormValues, type TaskSubtaskRow } from '../schema'

export interface SubtaskListProps {
  subtasks: readonly TaskSubtaskRow[]
  isAdding: boolean
  onAdd: (name: string) => Promise<void>
  onToggle: (subtask: TaskSubtaskRow, completed: boolean) => void
  onDelete: (subtask: TaskSubtaskRow) => void
}

export function SubtaskList({ subtasks, isAdding, onAdd, onToggle, onDelete }: SubtaskListProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubtaskFormValues>({
    resolver: zodResolver(subtaskFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: '' },
  })

  const done = subtasks.filter((subtask) => subtask.isDone).length

  async function submit(values: SubtaskFormValues) {
    try {
      await onAdd(values.name)
      reset()
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not add that subtask.',
      })
    }
  }

  return (
    <Stack gap="xs">
      {subtasks.length === 0 ? (
        <Text size="sm" c="dimmed">
          No subtasks yet. Break the work down if it takes more than one sitting.
        </Text>
      ) : (
        <>
          <Group gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {done} of {subtasks.length} done
            </Text>
            <Progress
              value={(done / subtasks.length) * 100}
              size="sm"
              flex={1}
              aria-hidden
              // The count above says it in words, so the bar is decoration.
            />
          </Group>

          <Stack component="ul" gap={4} p={0} style={{ listStyle: 'none' }}>
            {subtasks.map((subtask) => (
              <Group component="li" key={subtask.id} justify="space-between" wrap="nowrap" gap="xs">
                <Checkbox
                  checked={subtask.isDone}
                  onChange={(event) => onToggle(subtask, event.currentTarget.checked)}
                  label={subtask.name}
                  styles={{
                    label: { textDecoration: subtask.isDone ? 'line-through' : undefined },
                  }}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${subtask.name}`}
                  onClick={() => onDelete(subtask)}
                >
                  <IconTrash size={16} aria-hidden />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </>
      )}

      <form onSubmit={handleSubmit(submit)} noValidate>
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <TextInput
            {...register('name')}
            label="Add a subtask"
            placeholder="One step of this task"
            flex={1}
            error={errors.name?.message}
            errorProps={{ role: 'alert' }}
          />
          <Button
            type="submit"
            variant="default"
            mt={25}
            loading={isSubmitting || isAdding}
            leftSection={<IconPlus size={16} aria-hidden />}
          >
            Add
          </Button>
        </Group>
      </form>
    </Stack>
  )
}
