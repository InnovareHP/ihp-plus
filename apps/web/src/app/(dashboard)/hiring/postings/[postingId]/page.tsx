import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { PostingEditor } from '@/features/hiring/components/posting-editor'
import { requireHiringPage } from '@/features/hiring/access'
import { loadPosting, loadSettings } from '@/features/hiring/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Job posting' }

export default async function PostingPage({ params }: { params: Promise<{ postingId: string }> }) {
  const { postingId } = await params
  await requireHiringPage()

  const [posting, settings] = await Promise.all([
    loadPosting(postingId).catch(() => null),
    loadSettings(),
  ])
  if (!posting) notFound()

  return (
    <PageShell>
      <PageHeader
        title={posting.title}
        description={
          posting.applicantCount > 0
            ? `${posting.applicantCount} ${posting.applicantCount === 1 ? 'person has' : 'people have'} applied, ${posting.activeCount} still in progress.`
            : 'Nobody has applied yet.'
        }
        breadcrumbs={[{ label: 'Job postings', href: routes.hiring }, { label: posting.title }]}
      />
      <PostingEditor posting={posting} defaultStages={settings.defaultStages} />
    </PageShell>
  )
}
