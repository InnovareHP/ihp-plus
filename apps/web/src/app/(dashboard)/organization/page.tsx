import type { Metadata } from 'next'
import { LinkButton } from '@/components/link-button'
import { PageHeader, PageShell } from '@/components/page-shell'
import { OrganizationPanel } from '@/features/organization/components/organization-panel'
import { requireOrganizationManager } from '@/lib/auth-guard'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Organization' }

export default async function OrganizationPage() {
  await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Organization"
        description="Your company as the portal sees it — who belongs to it, how it is divided, and who is still waiting to join."
        actions={<LinkButton href={routes.invitations}>Invite someone</LinkButton>}
      />
      <OrganizationPanel />
    </PageShell>
  )
}
