import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { SkipLink } from '@/components/skip-link'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'

// Route group: every segment here revalidates the session and the onboarding gate first.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  const photoUrl =
    profile.photoKey && isObjectStorageConfigured() ? await objectUrl(profile.photoKey) : undefined

  return (
    <>
      <SkipLink />
      <DashboardShell
        canManageOrganization={canManageOrganization(membership)}
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
