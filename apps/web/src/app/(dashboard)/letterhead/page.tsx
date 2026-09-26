import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { LetterheadForm } from '@/features/letterhead/components/letterhead-form'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Letterhead' }

export default async function LetterheadPage() {
  await requireOnboarded()

  return (
    <PageShell>
      <PageHeader
        title="Letterhead"
        description="Put the IHP+ letterhead on a PDF or Word document and download the finished copy."
      />
      <LetterheadForm />
    </PageShell>
  )
}
