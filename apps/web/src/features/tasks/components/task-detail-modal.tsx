'use client'

import { Accordion, Badge, Box, Divider, Group, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { ActivityTimeline } from '@/components/activity-timeline'
import { EmptyState } from '@/components/empty-state'
import {
  useCompleteSubtask,
  useCreateSubtask,
  useDeleteSubtask,
  usePromoteSubtask,
  useReorderTask,
} from '../hooks/use-tasks'
import {
  useConversation,
  useDeleteAttachment,
  useDeleteComment,
  useEditComment,
  usePostComment,
  useTaskActivity,
} from '../hooks/use-conversation'
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskAssigneeRef,
  type TaskRow,
} from '../schema'
import { resolveMentions } from '../utils/mentions'
import { CommentComposer } from './comment-composer'
import { CommentItem } from './comment-item'
import { SubtaskList } from './subtask-list'

export interface TaskDetailModalProps {
  task: TaskRow | null
  /** Opening a subtask means opening the task it is. */
  onOpenTask: (taskId: string) => void
  viewer: TaskAssigneeRef
  colleagues: readonly TaskAssigneeRef[]
  onClose: () => void
}

export function TaskDetailModal({
  task,
  viewer,
  colleagues,
  onClose,
  onOpenTask,
}: TaskDetailModalProps) {
  const taskId = task?.id
  // A dialog this tall has nowhere to go on a phone, so there it takes the screen.
  const narrow = useMediaQuery('(max-width: 48em)')
  const conversation = useConversation(taskId)
  const activity = useTaskActivity(taskId)

  const post = usePostComment(taskId ?? '', viewer)
  const edit = useEditComment(taskId ?? '')
  const remove = useDeleteComment(taskId ?? '')
  const removeFile = useDeleteAttachment(taskId ?? '')

  const addSubtask = useCreateSubtask()
  const completeSubtask = useCompleteSubtask()
  const deleteSubtask = useDeleteSubtask()
  const reorderSubtask = useReorderTask()
  const promote = usePromoteSubtask()

  const comments = conversation.data?.comments ?? []

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
        <Stack gap="md">
          <Group gap="xs" wrap="wrap">
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

          {task.description ? (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {task.description}
            </Text>
          ) : null}

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

          {/* Folded away: history is reference, the conversation is the reason the panel is open. */}
          <Accordion variant="contained" chevronPosition="left">
            <Accordion.Item value="history">
              <Accordion.Control>History</Accordion.Control>
              <Accordion.Panel>
                {activity.isPending ? (
                  <Skeleton height={60} radius="md" aria-busy="true" />
                ) : activity.isError ? (
                  <Text size="sm" c="dimmed">
                    Could not load the history of this task.
                  </Text>
                ) : (
                  <ActivityTimeline
                    items={activity.data ?? []}
                    label={`History of task ${task.taskNumber}`}
                  />
                )}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Divider label="Conversation" labelPosition="left" />

          {conversation.isPending ? (
            <Stack gap="sm" aria-busy="true">
              <Skeleton height={72} radius="md" />
              <Skeleton height={72} radius="md" />
            </Stack>
          ) : conversation.isError ? (
            <EmptyState
              title="Could not load the conversation"
              description="Check your connection and try again."
            />
          ) : comments.length === 0 ? (
            <Text size="sm" c="dimmed">
              No comments yet. Say what you need and whoever is on this task hears about it.
            </Text>
          ) : (
            <Stack component="ul" gap="sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  viewerId={viewer.userId}
                  colleagues={colleagues}
                  onEdit={async (one, values) => {
                    await edit.mutateAsync({
                      commentId: one.id,
                      body: values.body,
                      mentions: resolveMentions(values.mentionUserIds, colleagues),
                    })
                  }}
                  onDelete={(one) => void remove.remove(one.id)}
                  onRemoveAttachment={(file) => void removeFile.remove(file.id)}
                />
              ))}
            </Stack>
          )}

          {/* The reply box stays in reach however long the thread runs. */}
          <Box
            pos="sticky"
            bottom={0}
            pt="sm"
            style={{
              backgroundColor: 'var(--mantine-color-body)',
              borderTop: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <CommentComposer
              colleagues={colleagues}
              isPosting={post.isPending}
              onPost={async (values) => {
                await post.mutateAsync({
                  body: values.body,
                  mentionUserIds: values.mentionUserIds,
                  mentions: resolveMentions(values.mentionUserIds, colleagues),
                  files: values.files,
                })
              }}
            />
          </Box>
        </Stack>
      ) : null}
    </Modal>
  )
}
