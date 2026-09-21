'use client'

import { Box, Skeleton, Stack, Text } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import {
  useConversation,
  useDeleteAttachment,
  useDeleteComment,
  useEditComment,
  usePostComment,
} from '../hooks/use-conversation'
import type { TaskAssigneeRef, TaskRow } from '../schema'
import { resolveMentions } from '../utils/mentions'
import { CommentComposer } from './comment-composer'
import { CommentItem } from './comment-item'

export interface TaskCommentsPanelProps {
  task: TaskRow
  viewer: TaskAssigneeRef
  colleagues: readonly TaskAssigneeRef[]
}

export function TaskCommentsPanel({ task, viewer, colleagues }: TaskCommentsPanelProps) {
  const conversation = useConversation(task.id)
  const post = usePostComment(task.id, viewer)
  const edit = useEditComment(task.id)
  const remove = useDeleteComment(task.id)
  const removeFile = useDeleteAttachment(task.id)

  const comments = conversation.data?.comments ?? []

  return (
    <Stack gap="md">
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
  )
}
