import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function FolderAccessLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={18} width="28rem" />
        <Skeleton height={38} />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
