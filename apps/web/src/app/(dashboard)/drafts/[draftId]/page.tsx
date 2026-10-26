import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { getDraft } from '@/features/drafts/actions'
import { DraftWorkspace } from '@/features/drafts/components/draft-workspace'
import { requireOrganizationManager } from '@/lib/auth-guard'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Draft' }

export default async function DraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params
  await requireOrganizationManager()

  const result = await getDraft(draftId)
  if (!result.ok) notFound()
  const draft = result.data

  return (
    <PageShell>
      <PageHeader
        title={draft.title}
        description={
          draft.proposalName
            ? `Based on the proposal “${draft.proposalName}” · ask the assistant to fill in or change anything.`
            : 'Tell the assistant the details, or ask it to add or change a section.'
        }
        breadcrumbs={[{ label: 'Contract drafts', href: routes.drafts }, { label: draft.title }]}
      />
      <DraftWorkspace initialDraft={draft} />
    </PageShell>
  )
}
