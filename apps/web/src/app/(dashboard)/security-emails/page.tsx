import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { SecurityDigestSkeleton } from '@/features/security-digest/components/security-digest-skeleton'
import { SecurityDigestWorkspace } from '@/features/security-digest/components/security-digest-workspace'
import { requireWebsitesPage } from '@/features/websites/access'

export const metadata: Metadata = { title: 'Security emails' }

export default async function SecurityEmailsPage() {
  await requireWebsitesPage()
  return (
    <PageShell>
      <PageHeader
        title="Security emails"
        description="A short security tip written by AI each week, reviewed by IT before it goes out on Monday."
      />
      {/* The open issue lives in the URL, which needs a boundary. */}
      <Suspense fallback={<SecurityDigestSkeleton />}>
        <SecurityDigestWorkspace />
      </Suspense>
    </PageShell>
  )
}
