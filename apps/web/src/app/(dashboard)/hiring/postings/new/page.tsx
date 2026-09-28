import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { PostingEditor } from '@/features/hiring/components/posting-editor'
import { requireHiringPage } from '@/features/hiring/access'
import { loadSettings } from '@/features/hiring/service'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'New job posting' }

export default async function NewPostingPage() {
  await requireHiringPage()
  const settings = await loadSettings()

  return (
    <PageShell>
      <PageHeader
        title="New job posting"
        description="Save it as a draft while you work on it; nobody outside sees it until you publish."
        breadcrumbs={[{ label: 'Job postings', href: routes.hiring }, { label: 'New posting' }]}
      />
      <PostingEditor defaultStages={settings.defaultStages} />
    </PageShell>
  )
}
