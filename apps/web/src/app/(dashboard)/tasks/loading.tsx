import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function TasksLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="8rem" />
        <Skeleton height={20} width="34rem" />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={116} radius="md" />
        ))}
      </SimpleGrid>
      <Stack gap="xs">
        <Skeleton height={38} />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={64} />
        ))}
      </Stack>
    </PageShell>
  )
}
