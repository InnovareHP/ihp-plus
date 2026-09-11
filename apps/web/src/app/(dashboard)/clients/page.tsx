import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader, PageShell } from '@/components/page-shell'
import { ClientsTable } from '@/features/clients/components/clients-table'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Every client this organization works with, who owns the relationship, and when they were last contacted."
      />
      {/* The table keeps its page, sort and filters in the URL, which needs a boundary. */}
      <Suspense fallback={<ClientsFallback />}>
        <ClientsTable />
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
