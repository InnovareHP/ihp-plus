'use client'

import { ActionIcon, Button, Group, Indicator, Menu, Stack, Text } from '@mantine/core'
import { IconBell } from '@tabler/icons-react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import {
  mentionFeedOf,
  useMarkAllMentionsRead,
  useMarkMentionRead,
  useMentions,
} from '../hooks/use-mentions'
import type { TaskMentionRow } from '../schema'
import { describeMoment } from '../utils/relative-time'

function taskHref(mention: TaskMentionRow) {
  return `${routes.tasks}?project=${mention.projectId}&task=${mention.taskId}`
}

/** The header's bell: what somebody asked the viewer, and the way back to where they asked it. */
export function MentionsMenu() {
  const feed = mentionFeedOf(useMentions(true).data)
  const markRead = useMarkMentionRead()
  const markAll = useMarkAllMentionsRead()

  const label =
    feed.unreadCount > 0 ? `Mentions, ${feed.unreadCount} unread` : 'Mentions, nothing unread'

  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={340}>
      <Menu.Target>
        {/* The count sits inside the button: on the wrapper, its aria-expanded lands on a div. */}
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={label}>
          <Indicator
            disabled={feed.unreadCount === 0}
            label={feed.unreadCount > 9 ? '9+' : feed.unreadCount}
            size={16}
            color="red"
            offset={-2}
          >
            <IconBell size={18} aria-hidden />
          </Indicator>
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Group justify="space-between" px="sm" py={6} wrap="nowrap">
          <Text size="sm" fw={600}>
            Mentions
          </Text>
          {feed.unreadCount > 0 ? (
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all read
            </Button>
          ) : null}
        </Group>

        {feed.mentions.length === 0 ? (
          <Text size="sm" c="dimmed" px="sm" pb="sm">
            Nobody has named you on a task yet.
          </Text>
        ) : (
          feed.mentions.map((mention) => (
            <Menu.Item
              key={mention.commentId}
              component={Link}
              href={taskHref(mention)}
              onClick={() => {
                if (!mention.isRead) markRead.mutate({ commentId: mention.commentId, read: true })
              }}
              bg={mention.isRead ? undefined : 'var(--mantine-color-brand-light)'}
            >
              <Stack gap={2}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={600}>
                    {mention.authorName}
                  </Text>
                  {/* The dot alone would say nothing to a screen reader. */}
                  {mention.isRead ? null : (
                    <Text size="xs" c="brand" fw={600}>
                      New
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {describeMoment(mention.createdAt)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  #{mention.taskNumber} {mention.taskName}
                </Text>
                <Text size="sm" lineClamp={2}>
                  {mention.excerpt}
                </Text>
              </Stack>
            </Menu.Item>
          ))
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
