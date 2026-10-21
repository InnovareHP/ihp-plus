import type { Metadata } from 'next'
import { LinkButton } from '@/components/link-button'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { OrgChart } from '@/features/directory/components/org-chart'
import { loadOrgChart } from '@/features/directory/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Org chart' }

// Read once on the server: nothing on the chart is edited or refetched from this page.
export default async function OrgChartPage() {
  const chart = await loadOrgChart()

  return (
    <PageShell>
      <PageHeader
        title="Org chart"
        breadcrumbs={[{ label: 'Directory', href: routes.directory }, { label: 'Org chart' }]}
        description="Each department with the people who lead it and the people in it."
        actions={
          <LinkButton href={routes.directory} variant="subtle" mih={{ base: 44, sm: 0 }}>
            Back to the directory
          </LinkButton>
        }
      />
      <OrgChart chart={chart} />
    </PageShell>
  )
}
