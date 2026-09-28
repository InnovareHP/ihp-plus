import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { InterviewerWorkspace } from '@/features/hiring/components/interviewer-workspace'
import { loadInterviewerView } from '@/features/hiring/scorecard-service'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Interview' }

// Open to the interview's own interviewers as well as HR, so this page carries no hiring guard.
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ interviewId: string }>
}) {
  const { interviewId } = await params
  await requireOnboarded()

  const view = await loadInterviewerView(interviewId).catch(() => null)
  if (!view) notFound()

  return (
    <PageShell>
      <PageHeader
        title={`Interview: ${view.applicant.fullName}`}
        description={`For ${view.applicant.postingTitle}.`}
      />
      <InterviewerWorkspace view={view} />
    </PageShell>
  )
}
