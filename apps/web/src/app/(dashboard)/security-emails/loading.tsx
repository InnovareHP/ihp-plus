import { Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'
import { SecurityDigestSkeleton } from '@/features/security-digest/components/security-digest-skeleton'

export default function SecurityEmailsLoading() {
  return (
    <PageShell>
      <Stack gap="md">
        <Skeleton height={32} width="14rem" />
        <Skeleton height={18} width="28rem" />
        <SecurityDigestSkeleton />
      </Stack>
    </PageShell>
  )
}
