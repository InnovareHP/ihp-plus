import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Same header and row heights as the loaded table, so nothing shifts when data lands.
export default function MembersLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={20} width="26rem" />
      </Stack>
      <Stack gap="xs">
        <Skeleton height={38} />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
