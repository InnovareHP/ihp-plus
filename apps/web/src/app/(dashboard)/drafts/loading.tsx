import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function DraftsLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="16rem" />
        <Skeleton height={18} width="28rem" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={44} radius="sm" />
        ))}
      </Stack>
    </PageShell>
  )
}
