'use client'

import { Divider, Stack, Text } from '@mantine/core'
import {
  useCompleteSubtask,
  useCreateSubtask,
  useDeleteSubtask,
  usePromoteSubtask,
  useReorderTask,
} from '../hooks/use-tasks'
import type { TaskRow } from '../schema'
import { SubtaskList } from './subtask-list'

export interface TaskAboutPanelProps {
  task: TaskRow
  /** Opening a subtask means opening the task it is. */
  onOpenTask: (taskId: string) => void
}

// What the task is: the words and the work under it. Everything said about it is next door.
export function TaskAboutPanel({ task, onOpenTask }: TaskAboutPanelProps) {
  const addSubtask = useCreateSubtask()
  const completeSubtask = useCompleteSubtask()
  const deleteSubtask = useDeleteSubtask()
  const reorderSubtask = useReorderTask()
  const promote = usePromoteSubtask()

  return (
    <Stack gap="md">
      {task.description ? (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {task.description}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          No description. Edit the task to say what it involves.
        </Text>
      )}

      <Divider label="Subtasks" labelPosition="left" />

      <SubtaskList
        subtasks={task.subtasks}
        isAdding={addSubtask.isPending}
        onAdd={async (name) => {
          await addSubtask.mutateAsync({ parent: task, name })
        }}
        onToggle={(subtask, completed) =>
          completeSubtask.mutate({ subtaskId: subtask.id, completed })
        }
        onDelete={(subtask) => deleteSubtask.mutate({ subtaskId: subtask.id })}
        onOpen={(subtask) => onOpenTask(subtask.id)}
        onMove={(subtask, beforeSubtaskId) =>
          reorderSubtask.mutate({
            taskId: subtask.id,
            listId: task.listId,
            beforeTaskId: beforeSubtaskId,
          })
        }
        onPromote={(subtask) => promote.mutate({ subtaskId: subtask.id })}
      />
    </Stack>
  )
}
