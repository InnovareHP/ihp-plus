import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function RequestsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="10rem" />
        <Skeleton height={20} width="34rem" />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={132} radius="md" />
        ))}
      </SimpleGrid>
      <Stack gap="xs">
        <Skeleton height={38} />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={56} />
        ))}
      </Stack>
    </PageShell>
  )
}
