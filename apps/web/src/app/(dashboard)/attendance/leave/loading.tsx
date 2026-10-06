import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function LeaveLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="10rem" />
        <Skeleton height={20} width="34rem" maw="100%" />
      </Stack>
      <Skeleton height={36} width="16rem" />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }}>
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={150} radius="md" />
        ))}
      </SimpleGrid>
    </PageShell>
  )
}
