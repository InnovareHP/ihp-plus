'use client'

import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconSparkles } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/empty-state'
import { feedLimitFromParam } from '../utils/feed'
import {
  useAcknowledgePost,
  useBulletinFeed,
  useCreatePost,
  useDeletePost,
  useEditPost,
  usePinPost,
  useRequireAck,
  useToggleReaction,
} from '../hooks/use-bulletin-feed'
import { BULLETIN_MAX_POSTS, BULLETIN_PAGE_SIZE, type BulletinPostRow } from '../schema'
import { useBulletinPeople } from '../hooks/use-bulletin-people'
import { BulletinFeedSkeleton } from './bulletin-feed-skeleton'
import { CelebrationSettingsModal } from './celebration-settings-modal'
import { PostCard } from './post-card'
import { PostComposer } from './post-composer'
import { PostThread } from './post-thread'

export function BulletinBoard() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const limit = feedLimitFromParam(searchParams.get('show'))
  const focusedPostId = searchParams.get('post')

  const feed = useBulletinFeed(limit)
  const create = useCreatePost()
  const edit = useEditPost()
  const pin = usePinPost()
  const react = useToggleReaction()
  const removal = useDeletePost()
  const acknowledge = useAcknowledgePost()
  const requireAck = useRequireAck()
  const [settingsOpen, settings] = useDisclosure(false)
  const people = useBulletinPeople()

  if (feed.isPending) return <BulletinFeedSkeleton />

  if (feed.isError) {
    return (
      <Alert color="red" variant="light" title="Could not load the bulletin board" role="alert">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">The posts did not load — check your connection and try again.</Text>
          <Button variant="default" onClick={() => void feed.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  const { posts, hasMore, viewerId, canModerate } = feed.data
  const pinned = posts.filter((post) => post.pinnedAt)
  const latest = posts.filter((post) => !post.pinnedAt)

  function renderPost(post: BulletinPostRow) {
    return (
      <PostCard
        key={post.id}
        post={post}
        viewerId={viewerId}
        canModerate={canModerate}
        onReact={(one, emoji) => react.mutate({ postId: one.id, emoji })}
        onEdit={async (one, values) => {
          await edit.mutateAsync({ postId: one.id, body: values.body })
        }}
        onPin={(one, next) => pin.mutate({ postId: one.id, pinned: next })}
        onDelete={(one) => void removal.remove(one.id)}
        onAcknowledge={(one) => acknowledge.mutate({ postId: one.id })}
        onRequireAck={(one, required) => requireAck.mutate({ postId: one.id, required })}
        focused={post.id === focusedPostId}
        thread={<PostThread postId={post.id} viewerId={viewerId} canModerate={canModerate} />}
      />
    )
  }

  function showOlder() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('show', String(Math.min(limit + BULLETIN_PAGE_SIZE, BULLETIN_MAX_POSTS)))
    // replace, not push: loading more is adjusting the view, not a new page.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Stack gap="xl" maw="44rem" w="100%" mx="auto">
      {canModerate ? (
        <Group justify="flex-end">
          <Button
            variant="subtle"
            leftSection={<IconSparkles size={18} aria-hidden />}
            onClick={settings.open}
          >
            Automatic posts
          </Button>
          <CelebrationSettingsModal opened={settingsOpen} onClose={settings.close} />
        </Group>
      ) : null}

      {/* Only admins post for now; everyone else joins in through reactions and replies. */}
      {canModerate ? (
        <PostComposer
          people={people.data ?? []}
          onPost={async (values) => {
            await create.mutateAsync(values)
          }}
        />
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          title="Nothing on the board yet"
          description={
            canModerate
              ? 'Post the first update — news, a welcome or a thank-you — and everyone in the company will see it.'
              : 'Company news from your admins shows up here, ready for you to react and reply.'
          }
        />
      ) : null}

      {pinned.length > 0 ? (
        <Stack component="section" gap="sm" aria-labelledby="bulletin-pinned">
          <Title order={2} size="h5" tt="uppercase" fz="sm" lts={0.6} id="bulletin-pinned">
            Pinned
          </Title>
          <Stack component="ul" gap="md" p={0} m={0} style={{ listStyle: 'none' }}>
            {pinned.map(renderPost)}
          </Stack>
        </Stack>
      ) : null}

      {latest.length > 0 ? (
        <Stack component="section" gap="sm" aria-labelledby="bulletin-latest">
          <Title order={2} size="h5" tt="uppercase" fz="sm" lts={0.6} id="bulletin-latest">
            Latest
          </Title>
          <Stack
            component="ul"
            gap="md"
            p={0}
            m={0}
            style={{ listStyle: 'none' }}
            // A background refetch dims rather than blanks, per the frontend rules.
            opacity={feed.isFetching && feed.isPlaceholderData ? 0.7 : 1}
          >
            {latest.map(renderPost)}
          </Stack>
        </Stack>
      ) : null}

      {hasMore && limit < BULLETIN_MAX_POSTS ? (
        <Group justify="center">
          <Button
            variant="default"
            radius="xl"
            onClick={showOlder}
            loading={feed.isPlaceholderData}
          >
            Show older posts
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}
