import { Card, SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Same header, stat-card and form heights as the loaded page, so nothing shifts.
export default function OrganizationLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={20} width="32rem" />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={116} radius="md" />
        ))}
      </SimpleGrid>
      <Card padding="lg">
        <Stack gap="md" maw={520}>
          <Skeleton height={24} width="12rem" />
          <Skeleton height={60} />
          <Skeleton height={76} />
          <Skeleton height={76} />
        </Stack>
      </Card>
    </PageShell>
  )
}
