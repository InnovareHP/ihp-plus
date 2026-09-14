import type { Metadata } from 'next'
import { LinkAnchor } from '@/components/link-anchor'
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
        description="Each department with the people who lead it and the people in it."
        actions={<LinkAnchor href={routes.directory}>Back to the directory</LinkAnchor>}
      />
      <OrgChart chart={chart} />
    </PageShell>
  )
}
