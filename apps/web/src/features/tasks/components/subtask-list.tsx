'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Menu,
  Progress,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconArrowBarUp,
  IconArrowDown,
  IconArrowUp,
  IconDotsVertical,
  IconExternalLink,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { subtaskFormSchema, type SubtaskFormValues, type TaskSubtaskRow } from '../schema'

export interface SubtaskListProps {
  subtasks: readonly TaskSubtaskRow[]
  isAdding: boolean
  onAdd: (name: string) => Promise<void>
  onToggle: (subtask: TaskSubtaskRow, completed: boolean) => void
  onDelete: (subtask: TaskSubtaskRow) => void
  onOpen: (subtask: TaskSubtaskRow) => void
  /** Moves it one place, by naming the row it lands before. */
  onMove: (subtask: TaskSubtaskRow, beforeSubtaskId: string | undefined) => void
  onPromote: (subtask: TaskSubtaskRow) => void
}

export function SubtaskList({
  subtasks,
  isAdding,
  onAdd,
  onToggle,
  onDelete,
  onOpen,
  onMove,
  onPromote,
}: SubtaskListProps) {
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
            {subtasks.map((subtask, index) => (
              <Group component="li" key={subtask.id} justify="space-between" wrap="nowrap" gap="xs">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Checkbox
                    checked={subtask.isDone}
                    onChange={(event) => onToggle(subtask, event.currentTarget.checked)}
                    aria-label={
                      subtask.isDone ? `Reopen ${subtask.name}` : `Complete ${subtask.name}`
                    }
                  />
                  {/* A subtask is a task: its name opens the same panel everything else does. */}
                  <Text
                    component="button"
                    type="button"
                    size="sm"
                    ta="left"
                    td={subtask.isDone ? 'line-through' : undefined}
                    onClick={() => onOpen(subtask)}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    {subtask.name}
                  </Text>
                </Group>

                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Actions for ${subtask.name}`}
                    >
                      <IconDotsVertical size={16} aria-hidden />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconExternalLink size={16} aria-hidden />}
                      onClick={() => onOpen(subtask)}
                    >
                      Open
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconArrowUp size={16} aria-hidden />}
                      disabled={index === 0}
                      onClick={() => onMove(subtask, subtasks[index - 1]?.id)}
                    >
                      Move up
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconArrowDown size={16} aria-hidden />}
                      disabled={index === subtasks.length - 1}
                      onClick={() => onMove(subtask, subtasks[index + 2]?.id)}
                    >
                      Move down
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconArrowBarUp size={16} aria-hidden />}
                      onClick={() => onPromote(subtask)}
                    >
                      Make it a task
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} aria-hidden />}
                      onClick={() => onDelete(subtask)}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
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
