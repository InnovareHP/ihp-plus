import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { requireWebsitesPage } from '@/features/websites/access'
import { WebsitesWorkspace } from '@/features/websites/components/websites-workspace'
import { todayOf } from '@/features/websites/service'

export const metadata: Metadata = { title: 'Website checks' }

export default async function WebsitesPage() {
  const access = await requireWebsitesPage()
  const today = access.organizationId ? await todayOf(access.organizationId) : ''

  return (
    <PageShell>
      <PageHeader
        title="Website checks"
        description="Client websites the IT department keeps running, checked at time in and time out."
      />
      {/* The day on screen lives in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={36} width="22rem" />
            <Skeleton height={150} radius="md" />
          </Stack>
        }
      >
        <WebsitesWorkspace
          canCheck={access.canCheck}
          canManage={access.canManage}
          canConfigure={access.canConfigure}
          itTeamId={access.itTeamId ?? ''}
          thisMonth={today.slice(0, 7)}
          userName={access.userName}
        />
      </Suspense>
    </PageShell>
  )
}
