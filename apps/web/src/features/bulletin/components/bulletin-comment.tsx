'use client'

import { ActionIcon, Avatar, Badge, Group, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { describeMoment } from '@/lib/relative-time'
import type { BulletinCommentRow } from '../schema'

export interface BulletinCommentProps {
  comment: BulletinCommentRow
  viewerId: string
  canModerate: boolean
  onDelete: (comment: BulletinCommentRow) => void
}

export function BulletinComment({
  comment,
  viewerId,
  canModerate,
  onDelete,
}: BulletinCommentProps) {
  const own = comment.authorId === viewerId
  const name = own ? 'You' : comment.authorName
  // A reply the server has not acknowledged has no id to delete by yet.
  const canDelete = (own || canModerate) && !comment.isSending

  return (
    <Group
      component="li"
      align="flex-start"
      gap="sm"
      wrap="nowrap"
      opacity={comment.isSending ? 0.6 : 1}
    >
      <Avatar size={28} radius="xl" color={own ? 'brand' : 'gray'} name={name} />
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs" wrap="wrap" align="baseline">
          <Text size="sm" fw={600}>
            {name}
          </Text>
          <Text size="xs" c="dimmed">
            {describeMoment(comment.createdAt)}
          </Text>
          {comment.isSending ? (
            <Badge size="sm" variant="light" color="gray">
              Sending…
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {comment.body}
        </Text>
      </Stack>
      {canDelete ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={own ? 'Delete your reply' : `Delete reply from ${comment.authorName}`}
          onClick={() => onDelete(comment)}
        >
          <IconTrash size={16} aria-hidden />
        </ActionIcon>
      ) : null}
    </Group>
  )
}
