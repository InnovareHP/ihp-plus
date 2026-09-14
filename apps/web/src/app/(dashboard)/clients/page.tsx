import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ClientTabs } from '@/features/clients/components/client-tabs'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { isStripeConfigured } from '@/lib/stripe'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const { profile } = await requireOnboarded()
  // Everyone reads contracts; writing one is a manager's job, same as the service enforces.
  const canManage = canManageOrganization(membershipOf(profile))
  // Read here so only whether the keys are set reaches the browser, never the keys.
  const billingEnabled = isStripeConfigured()

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Every client this organization works with, what they have signed, and the rates it is all priced from."
      />
      {/* The table keeps its page, sort and filters in the URL, which needs a boundary. */}
      <Suspense fallback={<ClientsFallback />}>
        <ClientTabs canManage={canManage} billingEnabled={billingEnabled} />
      </Suspense>
    </PageShell>
  )
}

function ClientsFallback() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={60} width="18rem" />
      <Skeleton height={38} />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
