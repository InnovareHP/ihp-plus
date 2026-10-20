import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Matches the dashboard's box sizes so the layout does not shift when data lands.
export default function DashboardLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="18rem" />
        <Skeleton height={20} width="12rem" />
      </Stack>
      <Stack gap="sm">
        <Skeleton height={26} width="12rem" />
        <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: 'xs', sm: 'md' }}>
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} h={{ base: 170, sm: 150 }} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
      <Stack gap="sm">
        <Skeleton height={26} width="9rem" />
        <Skeleton h={{ base: 200, sm: 120 }} radius="md" />
      </Stack>
    </PageShell>
  )
}
