import { Card, SimpleGrid, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// The dashboard's stat-card skeleton would reflow into an ID card and a form here.
export default function SettingsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="10rem" />
        <Skeleton height={20} width="min(32rem, 100%)" />
      </Stack>
      <Card padding="lg">
        <Skeleton height={72} />
      </Card>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card padding="lg">
          <Stack gap="md">
            <Skeleton height={20} width="9rem" />
            <Skeleton height={76} />
            <Skeleton height={76} />
            <Skeleton height={60} />
          </Stack>
        </Card>
        <Stack gap="md">
          <Skeleton height={160} radius="md" />
          <Skeleton height={240} radius="md" />
        </Stack>
      </SimpleGrid>
    </PageShell>
  )
}
