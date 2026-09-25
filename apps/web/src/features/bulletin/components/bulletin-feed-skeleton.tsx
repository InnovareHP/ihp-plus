import { Skeleton, Stack } from '@mantine/core'

// Same boxes as the composer and a few cards, so nothing reflows when the feed lands.
export function BulletinFeedSkeleton() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading the bulletin board">
      <Skeleton height={176} radius="md" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={148} radius="md" />
      ))}
    </Stack>
  )
}
