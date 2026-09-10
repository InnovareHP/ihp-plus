import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader, PageShell } from '@/components/page-shell'
import { MembersTable } from '@/features/members/components/members-table'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Members' }

export default async function MembersPage() {
  const { profile } = await requireOnboarded()

  // Not a redirect: an ordinary member should not learn that this route exists.
  if (!canManageOrganization(membershipOf(profile))) notFound()

  return (
    <PageShell>
      <PageHeader
        title="Members"
        description="Organization roles cover this company; the portal role decides who can manage everyone."
        breadcrumbs={breadcrumbsFor(routes.members)}
      />
      <MembersTable />
    </PageShell>
  )
}
