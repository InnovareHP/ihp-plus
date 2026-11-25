import { Skeleton, Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { AnalyticsView } from '@/features/website-analytics/components/analytics-view'
import { dayKeyOf } from '@/features/website-analytics/days'
import { REPORT_TIME_ZONE } from '@/features/website-analytics/sites'
import { requireWebsitesPage } from '@/features/websites/access'
import { WebsitesTabs } from '@/features/websites/components/websites-tabs'
import { WebsitesWorkspace } from '@/features/websites/components/websites-workspace'
import { todayOf } from '@/features/websites/service'

export const metadata: Metadata = { title: 'Websites' }

export default async function WebsitesPage() {
  const access = await requireWebsitesPage()
  const today = access.organizationId ? await todayOf(access.organizationId) : ''

  return (
    <PageShell>
      <PageHeader
        title="Websites"
        description="Client websites the IT department keeps running, checked at time in and time out."
      />
      {/* The tab, the day and the report range live in the URL, which needs a boundary. */}
      <Suspense
        fallback={
          <Stack gap="md" aria-busy="true">
            <Skeleton height={36} width="22rem" />
            <Skeleton height={150} radius="md" />
          </Stack>
        }
      >
        <WebsitesTabs
          checks={
            <WebsitesWorkspace
              canCheck={access.canCheck}
              canManage={access.canManage}
              canConfigure={access.canConfigure}
              canEditTimes={access.canEditTimes}
              itTeamId={access.itTeamId ?? ''}
              thisMonth={today.slice(0, 7)}
              userName={access.userName}
            />
          }
          analytics={
            access.canViewAnalytics ? (
              <AnalyticsView today={dayKeyOf(new Date(), REPORT_TIME_ZONE)} />
            ) : null
          }
        />
      </Suspense>
    </PageShell>
  )
}
