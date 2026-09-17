import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function RequestFormsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={20} width="36rem" />
      </Stack>
      <Stack gap="xs">
        <Skeleton height={38} />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
