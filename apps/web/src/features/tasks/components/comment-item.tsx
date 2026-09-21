'use client'

import { ActionIcon, Avatar, Badge, Group, Menu, Paper, Stack, Text } from '@mantine/core'
import { IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { AttachmentChip } from './attachment-chip'
import type {
  CommentEditValues,
  TaskAssigneeRef,
  TaskAttachmentRow,
  TaskCommentRow,
} from '../schema'
import { describeMoment } from '../utils/relative-time'
import { CommentEditForm } from './comment-edit-form'

export interface CommentItemProps {
  comment: TaskCommentRow
  /** The viewer, so only their own words offer edit and delete. */
  viewerId: string
  colleagues: readonly TaskAssigneeRef[]
  onEdit: (comment: TaskCommentRow, values: CommentEditValues) => Promise<void>
  onDelete: (comment: TaskCommentRow) => void
  onRemoveAttachment: (file: TaskAttachmentRow) => void
}

export function CommentItem({
  comment,
  viewerId,
  colleagues,
  onEdit,
  onDelete,
  onRemoveAttachment,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const own = comment.authorId === viewerId
  // A comment the server has not acknowledged has no id to edit or delete by yet.
  const mine = own && !comment.isSending

  return (
    <Paper
      component="li"
      withBorder
      radius="md"
      p="sm"
      opacity={comment.isSending ? 0.6 : 1}
      // Tinted as well as named: the byline says "You", so the colour is not carrying it alone.
      style={{
        backgroundColor: own ? 'var(--mantine-color-brand-light)' : undefined,
        borderColor: own ? 'var(--mantine-color-brand-light-hover)' : undefined,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="baseline">
          <Group gap="xs" align="center" wrap="wrap">
            <Avatar
              size={24}
              radius="xl"
              color={own ? 'brand' : 'gray'}
              name={comment.authorName}
            />
            <Text size="sm" fw={600}>
              {own ? 'You' : comment.authorName}
            </Text>
            <Text size="xs" c="dimmed">
              {describeMoment(comment.createdAt)}
              {comment.editedAt ? ' · edited' : ''}
            </Text>
            {comment.isSending ? (
              <Badge size="sm" variant="light" color="gray">
                Sending…
              </Badge>
            ) : null}
          </Group>

          {mine ? (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Actions for your comment">
                  <IconDotsVertical size={16} aria-hidden />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconPencil size={16} aria-hidden />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} aria-hidden />}
                  onClick={() => onDelete(comment)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null}
        </Group>

        {editing ? (
          <CommentEditForm
            comment={comment}
            colleagues={colleagues}
            onCancel={() => setEditing(false)}
            onSave={async (values) => {
              await onEdit(comment, values)
              setEditing(false)
            }}
          />
        ) : (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.body}
          </Text>
        )}

        {comment.mentions.length > 0 ? (
          <Group gap={6} wrap="wrap">
            <Text size="xs" c="dimmed">
              Notified
            </Text>
            {comment.mentions.map((person) => (
              <Badge key={person.userId} size="sm" variant="light">
                {person.name}
              </Badge>
            ))}
          </Group>
        ) : null}

        {comment.attachments.length > 0 ? (
          <Stack gap={6}>
            {comment.attachments.map((file) => (
              <AttachmentChip
                key={file.id}
                file={file}
                onRemove={mine ? onRemoveAttachment : undefined}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}
