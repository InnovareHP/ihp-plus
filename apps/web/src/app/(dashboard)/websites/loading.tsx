import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function WebsitesLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={18} width="28rem" />
        <Skeleton height={36} width="22rem" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={150} radius="md" />
        ))}
      </Stack>
    </PageShell>
  )
}
