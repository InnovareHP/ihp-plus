import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { SkipLink } from '@/components/skip-link'
import { canReachApprovals, requestsAccess } from '@/features/requests/guards'
import { canManageOrganization, getSession, membershipOf } from '@/lib/auth-guard'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'

// Route group: every segment here revalidates the session and the onboarding gate first.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const access = await requestsAccess()
  const { user, profile } = access
  const membership = membershipOf(profile)
  const session = await getSession()
  const photoUrl =
    profile.photoKey && isObjectStorageConfigured() ? await objectUrl(profile.photoKey) : undefined

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
