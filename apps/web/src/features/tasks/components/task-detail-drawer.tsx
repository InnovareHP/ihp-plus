'use client'

import { Badge, Divider, Drawer, Group, Skeleton, Stack, Text } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import {
  useConversation,
  useDeleteAttachment,
  useDeleteComment,
  useEditComment,
  usePostComment,
  useUploadAttachment,
} from '../hooks/use-conversation'
import {
  MENTION_EVERYONE,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskAssigneeRef,
  type TaskRow,
} from '../schema'
import { AttachmentChip } from './attachment-chip'
import { CommentComposer } from './comment-composer'
import { CommentItem } from './comment-item'

export interface TaskDetailDrawerProps {
  task: TaskRow | null
  viewer: TaskAssigneeRef
  colleagues: readonly TaskAssigneeRef[]
  onClose: () => void
}

export function TaskDetailDrawer({ task, viewer, colleagues, onClose }: TaskDetailDrawerProps) {
  const taskId = task?.id
  const conversation = useConversation(taskId)

  const post = usePostComment(taskId ?? '', viewer)
  const edit = useEditComment(taskId ?? '')
  const remove = useDeleteComment(taskId ?? '')
  const removeFile = useDeleteAttachment(taskId ?? '')
  const upload = useUploadAttachment(taskId ?? '')

  const comments = conversation.data?.comments ?? []
  // Files posted inside a comment are shown there; this panel is the task's own shelf.
  const taskFiles = (conversation.data?.attachments ?? []).filter((file) => !file.commentId)

  return (
    <Drawer
      opened={task !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={task ? `#${task.taskNumber} ${task.name}` : 'Task'}
      closeButtonProps={{ 'aria-label': 'Close this task' }}
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

          <Divider label="Files on this task" labelPosition="left" />

          {taskFiles.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nothing attached yet. Attach a file below and it lands here.
            </Text>
          ) : (
            <Stack gap={6}>
              {taskFiles.map((file) => (
                <AttachmentChip
                  key={file.id}
                  file={file}
                  isRemoving={removeFile.isPending}
                  onRemove={() => removeFile.mutate({ attachmentId: file.id })}
                />
              ))}
            </Stack>
          )}

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
                  isSaving={edit.isPending}
                  onEdit={(commentId, body, mentions) => edit.mutate({ commentId, body, mentions })}
                  onDelete={(one) => remove.mutate({ commentId: one.id })}
                  onRemoveAttachment={(file) => removeFile.mutate({ attachmentId: file.id })}
                />
              ))}
            </Stack>
          )}

          <CommentComposer
            colleagues={colleagues}
            isPosting={post.isPending}
            isUploading={upload.isPending}
            onUpload={(file) => upload.mutateAsync(file).catch(() => undefined)}
            onPost={async (values) => {
              await post.mutateAsync({
                body: values.body,
                mentionUserIds: values.mentionUserIds,
                // The server expands @everyone against the org; the thread shows who is loaded here.
                mentions: values.mentionUserIds.includes(MENTION_EVERYONE)
                  ? [...colleagues]
                  : colleagues.filter((person) => values.mentionUserIds.includes(person.userId)),
                attachmentIds: values.attachments.map((file) => file.id),
                pendingFiles: values.attachments,
              })
            }}
          />
        </Stack>
      ) : null}
    </Drawer>
  )
}
