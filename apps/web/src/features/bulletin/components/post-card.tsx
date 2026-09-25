'use client'

import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Menu,
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
import type { BulletinPostRow, PostEditValues } from '../schema'
import { ImageLightbox } from './image-lightbox'
import { PostEditForm } from './post-edit-form'
import { PostImageGrid } from './post-image-grid'
import { ReactionBar } from './reaction-bar'

export interface PostCardProps {
  post: BulletinPostRow
  viewerId: string
  canModerate: boolean
  onReact: (post: BulletinPostRow, emoji: string) => void
  onEdit: (post: BulletinPostRow, values: PostEditValues) => Promise<void>
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
  const [photo, setPhoto] = useState<number | undefined>(undefined)
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
    <Card
      component="li"
      withBorder
      radius="lg"
      shadow="xs"
      padding="lg"
      opacity={post.isSending ? 0.6 : 1}
      // A brand edge as well as the label, so the colour never carries "pinned" alone.
      style={{
        borderColor: pinned ? 'var(--mantine-primary-color-light-hover)' : undefined,
        borderTop: pinned ? '3px solid var(--mantine-primary-color-filled)' : undefined,
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Avatar size={44} radius="xl" color="initials" name={post.authorName || name} />
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Text fw={600} lh={1.2}>
                  {name}
                </Text>
                {pinned ? (
                  <Badge
                    size="sm"
                    variant="light"
                    radius="sm"
                    leftSection={<IconPin size={12} aria-hidden />}
                  >
                    Pinned
                  </Badge>
                ) : null}
                {post.isSending ? (
                  <Badge size="sm" variant="light" color="gray" radius="sm">
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
                  size="lg"
                  radius="xl"
                  aria-label={own ? 'Actions for your post' : `Actions for the post by ${name}`}
                >
                  <IconDotsVertical size={18} aria-hidden />
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
        ) : post.body ? (
          <Text lh={1.65} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {post.body}
          </Text>
        ) : null}

        {post.images.length > 0 ? (
          <>
            <PostImageGrid images={post.images} authorName={name} onOpen={setPhoto} />
            <ImageLightbox
              images={post.images}
              index={photo}
              onIndexChange={setPhoto}
              onClose={() => setPhoto(undefined)}
            />
          </>
        ) : null}

        <Divider />

        <Group justify="space-between" gap="xs" wrap="wrap">
          <ReactionBar
            reactions={post.reactions}
            disabled={!settled}
            onToggle={(emoji) => onReact(post, emoji)}
          />
          <Button
            variant="subtle"
            color="gray"
            radius="xl"
            leftSection={<IconMessageCircle size={18} aria-hidden />}
            aria-expanded={repliesOpen}
            aria-controls={threadId}
            disabled={!settled}
            onClick={() => setRepliesOpen((open) => !open)}
          >
            {repliesOpen ? 'Hide replies' : repliesLabel(post.commentCount)}
          </Button>
        </Group>

        <div id={threadId}>{repliesOpen ? thread : null}</div>
      </Stack>
    </Card>
  )
}
