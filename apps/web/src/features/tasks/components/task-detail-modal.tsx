'use client'

import { Badge, Group, Modal, Tabs, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskAssigneeRef,
  type TaskRow,
  type TaskTab,
} from '../schema'
import { TaskAboutPanel } from './task-about-panel'
import { TaskCommentsPanel } from './task-comments-panel'
import { TaskHistoryPanel } from './task-history-panel'

export interface TaskDetailModalProps {
  task: TaskRow | null
  /** Which panel is open. It lives in the URL, so a link can point at the conversation. */
  tab: TaskTab
  onTabChange: (tab: TaskTab) => void
  /** Opening a subtask means opening the task it is. */
  onOpenTask: (taskId: string) => void
  viewer: TaskAssigneeRef
  colleagues: readonly TaskAssigneeRef[]
  onClose: () => void
}

export function TaskDetailModal({
  task,
  tab,
  onTabChange,
  viewer,
  colleagues,
  onClose,
  onOpenTask,
}: TaskDetailModalProps) {
  // A dialog this tall has nowhere to go on a phone, so there it takes the screen.
  const narrow = useMediaQuery('(max-width: 48em)')

  return (
    <Modal
      opened={task !== null}
      onClose={onClose}
      size="xl"
      centered
      fullScreen={narrow}
      title={task ? `#${task.taskNumber} ${task.name}` : 'Task'}
      closeButtonProps={{ 'aria-label': 'Close this task' }}
      // The conversation grows without end; the dialog scrolls rather than the page behind it.
      styles={{ content: { maxHeight: '85vh' } }}
    >
      {task ? (
        <Tabs
          value={tab}
          onChange={(next) => onTabChange((next ?? 'task') as TaskTab)}
          // Panels stay mounted: switching tabs must not throw away a half-typed comment.
          keepMounted
        >
          {/* Above the tabs, because where a task stands is why the dialog was opened. */}
          <Group gap="xs" wrap="wrap" mb="md">
            <Badge color={task.status.color ? undefined : 'gray'} variant="light">
              {task.status.name}
            </Badge>
            <Badge color={TASK_PRIORITY_COLORS[task.priority]} variant="light">
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>
            {task.assignees.length > 0 ? (
              <Text size="sm" c="dimmed">
                {task.assignees.map((one) => one.name).join(', ')}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Unassigned
              </Text>
            )}
          </Group>

          <Tabs.List aria-label={`Task #${task.taskNumber}`} mb="md">
            <Tabs.Tab value="task">Task</Tabs.Tab>
            <Tabs.Tab
              value="comments"
              // Read out as a sentence; the badge beside the word is not one on its own.
              aria-label={task.commentCount > 0 ? `Comments (${task.commentCount})` : 'Comments'}
              // The count is the reason to open the tab, so it shows without opening it.
              rightSection={
                task.commentCount > 0 ? (
                  <Badge size="sm" variant="light" circle>
                    {task.commentCount}
                  </Badge>
                ) : null
              }
            >
              Comments
            </Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="task">
            <TaskAboutPanel task={task} onOpenTask={onOpenTask} />
          </Tabs.Panel>

          <Tabs.Panel value="comments">
            <TaskCommentsPanel task={task} viewer={viewer} colleagues={colleagues} />
          </Tabs.Panel>

          <Tabs.Panel value="history">
            <TaskHistoryPanel task={task} isActive={tab === 'history'} />
          </Tabs.Panel>
        </Tabs>
      ) : null}
    </Modal>
  )
}
