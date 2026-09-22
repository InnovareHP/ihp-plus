import { Card, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Same header, clock and table heights as the loaded page, so nothing shifts.
export default function AttendanceLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={20} width="32rem" />
      </Stack>
      <Card padding="lg">
        <Stack gap="md">
          <Skeleton height={28} width="10rem" />
          <Skeleton height={56} />
          <Skeleton height={40} />
        </Stack>
      </Card>
      <Skeleton height={320} radius="md" />
    </PageShell>
  )
}
