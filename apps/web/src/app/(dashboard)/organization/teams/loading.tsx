import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function TeamsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={20} width="34rem" />
      </Stack>
      <Stack gap="md">
        <Skeleton height={60} width="18rem" />
        <Skeleton height={38} />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
