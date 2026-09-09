import { Skeleton, SimpleGrid, Stack } from '@mantine/core'

// Matches the dashboard's box sizes so the layout does not shift when data lands.
export default function DashboardLoading() {
  return (
    <Stack gap="lg" aria-busy="true">
      <Stack gap={4}>
        <Skeleton height={32} width="18rem" />
        <Skeleton height={20} width="12rem" />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
        <Skeleton height={140} radius="md" />
      </SimpleGrid>
    </Stack>
  )
}
