import { Card, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

export default function InvitationsLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="12rem" />
        <Skeleton height={20} width="36rem" />
      </Stack>
      <Card padding="lg">
        <Stack gap="md">
          <Skeleton height={24} width="10rem" />
          <Skeleton height={60} />
          <Skeleton height={76} />
          <Skeleton height={36} width={140} />
        </Stack>
      </Card>
      <Card padding="lg">
        <Stack gap="xs">
          <Skeleton height={24} width="14rem" mb="xs" />
          <Skeleton height={38} />
          {[0, 1].map((row) => (
            <Skeleton key={row} height={56} />
          ))}
        </Stack>
      </Card>
    </PageShell>
  )
}
