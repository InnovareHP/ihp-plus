'use client'

import { Button, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { useComments, useCreateComment, useDeleteComment } from '../hooks/use-bulletin-comments'
import { useBulletinPeople } from '../hooks/use-bulletin-people'
import { BulletinComment } from './bulletin-comment'
import { ReplyComposer } from './reply-composer'

export interface PostThreadProps {
  postId: string
  viewerId: string
  canModerate: boolean
}

export function PostThread({ postId, viewerId, canModerate }: PostThreadProps) {
  const comments = useComments(postId, true)
  const reply = useCreateComment(postId, viewerId)
  const removal = useDeleteComment(postId)
  const people = useBulletinPeople()

  return (
    // A tinted well sets the conversation apart from the announcement it answers.
    <Paper radius="md" p="md" bg="var(--mantine-color-default-hover)">
      <Stack gap="sm">
        {comments.isPending ? (
          <Stack gap="xs" aria-busy="true" aria-label="Loading replies">
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        ) : comments.isError ? (
          <Stack gap="xs" align="flex-start" role="alert">
            <Text size="sm">Could not load the replies — check your connection and try again.</Text>
            <Button size="compact-sm" variant="default" onClick={() => void comments.refetch()}>
              Try again
            </Button>
          </Stack>
        ) : comments.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            No replies yet. Start the conversation below.
          </Text>
        ) : (
          <Stack component="ul" gap="sm" p={0} m={0} style={{ listStyle: 'none' }}>
            {comments.data.map((comment) => (
              <BulletinComment
                key={comment.id}
                comment={comment}
                viewerId={viewerId}
                canModerate={canModerate}
                onDelete={(one) => void removal.remove(one.id)}
              />
            ))}
          </Stack>
        )}

        <ReplyComposer
          people={people.data ?? []}
          onReply={async (values) => void (await reply.mutateAsync(values))}
        />
      </Stack>
    </Paper>
  )
}
