'use client'

import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconDotsVertical,
  IconMessageCircle,
  IconPencil,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from '@tabler/icons-react'
import { useId, useState, type ReactNode } from 'react'
import { describeMoment } from '@/lib/relative-time'
import type { BulletinPostRow, PostFormValues } from '../schema'
import { PostEditForm } from './post-edit-form'
import { ReactionBar } from './reaction-bar'

export interface PostCardProps {
  post: BulletinPostRow
  viewerId: string
  canModerate: boolean
  onReact: (post: BulletinPostRow, emoji: string) => void
  onEdit: (post: BulletinPostRow, values: PostFormValues) => Promise<void>
  onPin: (post: BulletinPostRow, pinned: boolean) => void
  onDelete: (post: BulletinPostRow) => void
  /** Mounted only while the replies are open, so a closed thread fetches nothing. */
  thread: ReactNode
}

function repliesLabel(count: number) {
  if (count === 0) return 'Reply'
  return count === 1 ? '1 reply' : `${count} replies`
}

export function PostCard({
  post,
  viewerId,
  canModerate,
  onReact,
  onEdit,
  onPin,
  onDelete,
  thread,
}: PostCardProps) {
  const [editing, setEditing] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const threadId = useId()

  const own = post.authorId === viewerId
  const name = own ? 'You' : post.authorName
  // An optimistic post has no id the server knows, so nothing can act on it yet.
  const settled = !post.isSending
  const canEdit = own && settled
  const canDelete = (own || canModerate) && settled
  const canPin = canModerate && settled
  const pinned = Boolean(post.pinnedAt)

  return (
    <Paper
      component="li"
      withBorder
      radius="md"
      p="md"
      opacity={post.isSending ? 0.6 : 1}
      // Tinted as well as badged, so the colour never carries "pinned" alone.
      style={{
        borderColor: pinned ? 'var(--mantine-color-brand-light-hover)' : undefined,
        backgroundColor: pinned ? 'var(--mantine-color-brand-light)' : undefined,
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Avatar radius="xl" color={own ? 'brand' : 'gray'} name={name} />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Text fw={600}>{name}</Text>
                {pinned ? (
                  <Badge size="sm" variant="filled" leftSection={<IconPin size={12} aria-hidden />}>
                    Pinned
                  </Badge>
                ) : null}
                {post.isSending ? (
                  <Badge size="sm" variant="light" color="gray">
                    Posting…
                  </Badge>
                ) : null}
              </Group>
              <Text size="xs" c="dimmed">
                {describeMoment(post.createdAt)}
                {post.editedAt ? ' · edited' : ''}
              </Text>
            </Stack>
          </Group>

          {canEdit || canDelete || canPin ? (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={own ? 'Actions for your post' : `Actions for the post by ${name}`}
                >
                  <IconDotsVertical size={16} aria-hidden />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canPin ? (
                  <Menu.Item
                    leftSection={
                      pinned ? (
                        <IconPinnedOff size={16} aria-hidden />
                      ) : (
                        <IconPin size={16} aria-hidden />
                      )
                    }
                    onClick={() => onPin(post, !pinned)}
                  >
                    {pinned ? 'Unpin from the top' : 'Pin to the top'}
                  </Menu.Item>
                ) : null}
                {canEdit ? (
                  <Menu.Item
                    leftSection={<IconPencil size={16} aria-hidden />}
                    onClick={() => setEditing(true)}
                  >
                    Edit post
                  </Menu.Item>
                ) : null}
                {canDelete ? (
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={16} aria-hidden />}
                    onClick={() => onDelete(post)}
                  >
                    Delete post
                  </Menu.Item>
                ) : null}
              </Menu.Dropdown>
            </Menu>
          ) : null}
        </Group>

        {editing ? (
          <PostEditForm
            body={post.body}
            onCancel={() => setEditing(false)}
            onSave={async (values) => {
              await onEdit(post, values)
              setEditing(false)
            }}
          />
        ) : (
          <Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{post.body}</Text>
        )}

        <Group justify="space-between" gap="xs" wrap="wrap">
          <ReactionBar
            reactions={post.reactions}
            disabled={!settled}
            onToggle={(emoji) => onReact(post, emoji)}
          />
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconMessageCircle size={16} aria-hidden />}
            aria-expanded={repliesOpen}
            aria-controls={threadId}
            disabled={!settled}
            onClick={() => setRepliesOpen((open) => !open)}
          >
            {repliesOpen ? 'Hide replies' : repliesLabel(post.commentCount)}
          </Button>
        </Group>

        <div id={threadId}>
          {repliesOpen ? (
            <Stack gap="sm">
              <Divider />
              {thread}
            </Stack>
          ) : null}
        </div>
      </Stack>
    </Paper>
  )
}
