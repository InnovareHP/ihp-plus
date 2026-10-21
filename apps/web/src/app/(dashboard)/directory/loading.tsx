import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'
import { DirectorySkeleton } from '@/features/directory/components/directory-skeleton'
import { DirectoryToolbarSkeleton } from '@/features/directory/components/directory-toolbar-skeleton'

export default function DirectoryLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="12rem" maw="100%" />
        <Skeleton height={18} width="28rem" maw="100%" />
        <DirectoryToolbarSkeleton />
        <DirectorySkeleton />
      </Stack>
    </PageShell>
  )
}
