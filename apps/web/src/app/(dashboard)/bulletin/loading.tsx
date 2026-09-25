import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'
import { BulletinFeedSkeleton } from '@/features/bulletin/components/bulletin-feed-skeleton'

export default function BulletinLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={20} width="34rem" maw="100%" />
      </Stack>
      <BulletinFeedSkeleton />
    </PageShell>
  )
}
