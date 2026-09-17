import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function LibraryLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={18} width="30rem" />
        <Skeleton height={20} width="16rem" />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
