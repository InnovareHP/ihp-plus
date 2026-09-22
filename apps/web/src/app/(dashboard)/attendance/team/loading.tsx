import { Card, SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Same header, tab bar and stat-card heights as the loaded page, so nothing shifts.
export default function TeamAttendanceLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="16rem" />
        <Skeleton height={20} width="34rem" />
      </Stack>
      <Skeleton height={40} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={116} radius="md" />
        ))}
      </SimpleGrid>
      <Card padding="lg">
        <Skeleton height={280} />
      </Card>
    </PageShell>
  )
}
