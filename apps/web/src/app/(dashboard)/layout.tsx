import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { SkipLink } from '@/components/skip-link'
import { canReachApprovals, requestsAccess } from '@/features/requests/guards'
import { canManageOrganization, getSession, membershipOf } from '@/lib/auth-guard'
import { profilePhotoUrl } from '@/lib/profile-photo'

// Route group: every segment here revalidates the session and the onboarding gate first.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const access = await requestsAccess()
  const { user, profile } = access
  const membership = membershipOf(profile)
  const session = await getSession()
  const photoUrl = profilePhotoUrl(user.id, profile.photoKey)

  return (
    <>
      <SkipLink />
      <DashboardShell
        canManageOrganization={canManageOrganization(membership)}
        canApproveRequests={canReachApprovals(access)}
        impersonating={Boolean(session?.session.impersonatedBy)}
        organization={{
          name: membership.organization?.name ?? 'Innovare Health Partners',
          role: membership.organizationRole,
        }}
        user={{
          name: profile.preferredName ?? user.name,
          email: user.email,
          jobTitle: profile.jobTitle,
          photoUrl,
        }}
      >
        {children}
      </DashboardShell>
    </>
  )
}
