import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { SkipLink } from '@/components/skip-link'
import { requireOnboarded } from '@/lib/auth-guard'

// Route group: every segment here revalidates the session and the onboarding gate first.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireOnboarded()

  return (
    <>
      <SkipLink />
      <DashboardShell
        user={{
          name: profile.preferredName ?? user.name,
          email: user.email,
          jobTitle: profile.jobTitle,
        }}
      >
        {children}
      </DashboardShell>
    </>
  )
}
