import type { Metadata } from 'next'
import { PageHeader, PageShell } from '@/components/page-shell'
import { InvitationsPanel } from '@/features/organization/components/invitations-panel'
import { requireOrganizationManager } from '@/lib/auth-guard'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Invitations' }

export default async function InvitationsPage() {
  const { user, profile } = await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Invitations"
        description="Invite a colleague by email and they join this organization in the department you choose."
        breadcrumbs={breadcrumbsFor(routes.invitations)}
      />
      <InvitationsPanel invitedBy={profile.preferredName ?? user.name} />
    </PageShell>
  )
}
