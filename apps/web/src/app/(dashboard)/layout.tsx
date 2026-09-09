import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { SkipLink } from '@/components/skip-link'
import { requireSession } from '@/lib/auth-guard'

// Route group: every segment here revalidates the session before anything renders.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession()

  return (
    <>
      <SkipLink />
      <DashboardShell user={{ name: user.name, email: user.email }}>{children}</DashboardShell>
    </>
  )
}
