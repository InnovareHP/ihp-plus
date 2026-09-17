import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Matches the chart's card grid so nothing shifts when the departments land.
export default function OrgChartLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={20} width="24rem" />
      </Stack>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <Skeleton key={card} height={220} radius="md" />
        ))}
      </SimpleGrid>
    </PageShell>
  )
}
