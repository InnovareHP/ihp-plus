'use client'

import { ActionIcon, Badge, Button, Card, Divider, Group, Menu, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChecklist,
  IconDotsVertical,
  IconMessageCircle,
  IconPencil,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { describeMoment } from '@/lib/relative-time'
import { CELEBRATION_LABELS, type BulletinPostRow, type PostEditValues } from '../schema'
import { ImageLightbox } from './image-lightbox'
import { AckBar } from './ack-bar'
import { AckStatusModal } from './ack-status-modal'
import { PostAuthorAvatar } from './post-author-avatar'
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
  onAcknowledge: (post: BulletinPostRow) => void
  onRequireAck: (post: BulletinPostRow, required: boolean) => void
  /** Mounted only while the replies are open, so a closed thread fetches nothing. */
  thread: ReactNode
  /** The post a link pointed at: it opens its replies and scrolls into view. */
  focused?: boolean
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
  onAcknowledge,
  onRequireAck,
  thread,
  focused = false,
}: PostCardProps) {
  const [editing, setEditing] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(focused)
  const cardRef = useRef<HTMLLIElement>(null)
  const [statusOpen, status] = useDisclosure(false)
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

  // Scrolling is an imperative browser API, and the card exists only once React has committed it.
  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView({ block: 'start' })
  }, [focused])

  return (
    <Card
      ref={cardRef}
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
        outline: focused ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: 2,
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <PostAuthorAvatar kind={post.kind} name={post.authorName || name} />
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Text fw={600} lh={1.2}>
                  {name}
                </Text>
                {post.kind !== 'post' ? (
                  <Badge size="sm" variant="light" color="teal" radius="sm">
                    {CELEBRATION_LABELS[post.kind]}
                  </Badge>
                ) : null}
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
                {post.requiresAck ? (
                  <Badge
                    size="sm"
                    variant="light"
                    color="orange"
                    radius="sm"
                    leftSection={<IconChecklist size={12} aria-hidden />}
                  >
                    Please confirm
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
                {canPin ? (
                  <Menu.Item
                    leftSection={<IconChecklist size={16} aria-hidden />}
                    onClick={() => onRequireAck(post, !post.requiresAck)}
                  >
                    {post.requiresAck ? 'Stop asking for confirmation' : 'Ask everyone to confirm'}
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

        {post.requiresAck ? (
          <>
            <AckBar
              acknowledgedByMe={post.acknowledgedByMe}
              ackCount={post.ackCount}
              ackAudience={post.ackAudience}
              isAuthor={own}
              canModerate={canModerate}
              disabled={!settled}
              onAcknowledge={() => onAcknowledge(post)}
              onShowStatus={status.open}
            />
            {canModerate ? (
              <AckStatusModal postId={post.id} opened={statusOpen} onClose={status.close} />
            ) : null}
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
