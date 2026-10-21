import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'
import { ClientsSkeleton } from '@/features/clients/components/clients-skeleton'

export default function ClientsLoading() {
  return (
    <PageShell>
      <Stack gap="md" aria-busy="true">
        <Skeleton height={32} width="12rem" maw="100%" />
        <Skeleton height={18} width="28rem" maw="100%" />
        <ClientsSkeleton />
      </Stack>
    </PageShell>
  )
}
