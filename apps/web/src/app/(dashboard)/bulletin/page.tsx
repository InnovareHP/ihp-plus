import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { BulletinBoard } from '@/features/bulletin/components/bulletin-board'
import { BulletinFeedSkeleton } from '@/features/bulletin/components/bulletin-feed-skeleton'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Bulletin board' }

export default async function BulletinPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Bulletin board"
        description="Company news from the admins. React and reply to join the conversation."
      />
      {/* How many posts are shown lives in the URL, which needs a boundary. */}
      <Suspense fallback={<BulletinFeedSkeleton />}>
        <BulletinBoard />
      </Suspense>
    </PageShell>
  )
}
