import { SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function DirectoryLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={18} width="28rem" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
            <Skeleton key={card} height={196} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
    </PageShell>
  )
}
