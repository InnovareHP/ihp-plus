'use client'

import { ActionIcon, Badge, Button, Group, Menu, Paper, Stack, Text, Textarea } from '@mantine/core'
import { IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { AttachmentChip } from './attachment-chip'
import type { TaskAssigneeRef, TaskAttachmentRow, TaskCommentRow } from '../schema'

const posted = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export interface CommentItemProps {
  comment: TaskCommentRow
  /** The viewer, so only their own words offer edit and delete. */
  viewerId: string
  isSaving: boolean
  onEdit: (commentId: string, body: string, mentions: readonly TaskAssigneeRef[]) => void
  onDelete: (comment: TaskCommentRow) => void
  onRemoveAttachment: (file: TaskAttachmentRow) => void
}

export function CommentItem({
  comment,
  viewerId,
  isSaving,
  onEdit,
  onDelete,
  onRemoveAttachment,
}: CommentItemProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const mine = comment.authorId === viewerId

  function save() {
    if (draft === null || draft.trim().length === 0) return
    // Re-sending the mentions keeps them: the server replaces the whole list on every edit.
    onEdit(comment.id, draft.trim(), comment.mentions)
    setDraft(null)
  }

  return (
    <Paper component="li" withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="baseline">
          <Group gap="xs" align="baseline" wrap="wrap">
            <Text size="sm" fw={600}>
              {comment.authorName}
            </Text>
            <Text size="xs" c="dimmed">
              {posted.format(new Date(comment.createdAt))}
              {comment.editedAt ? ' · edited' : ''}
            </Text>
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
                  onClick={() => setDraft(comment.body)}
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

        {draft === null ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.body}
          </Text>
        ) : (
          <Stack gap="xs">
            <Textarea
              label="Edit your comment"
              value={draft}
              autosize
              minRows={2}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <Group gap="xs">
              <Button size="xs" loading={isSaving} onClick={save}>
                Save changes
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
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
