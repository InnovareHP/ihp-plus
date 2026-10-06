import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function HiringReportsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={20} width="34rem" />
      </Stack>
      <Skeleton height={60} width="32rem" maw="100%" />
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={116} />
        ))}
      </SimpleGrid>
      <Skeleton height={320} />
    </PageShell>
  )
}
