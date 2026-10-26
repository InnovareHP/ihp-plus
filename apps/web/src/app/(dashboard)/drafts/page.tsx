import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { DraftsTable } from '@/features/drafts/components/drafts-table'
import { NewContractButton } from '@/features/drafts/components/new-contract-button'
import { requireOrganizationManager } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Contract drafts' }

export default async function DraftsPage() {
  await requireOrganizationManager()

  return (
    <PageShell>
      <PageHeader
        title="Contract drafts"
        description="Turn a client’s proposal into a contract by chatting with the AI, then download it on the Innovare HP letterhead."
        actions={<NewContractButton />}
      />
      <DraftsTable />
    </PageShell>
  )
}
