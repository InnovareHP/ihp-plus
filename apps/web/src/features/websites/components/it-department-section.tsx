'use client'

import { useRouter } from 'next/navigation'
import { PageSection } from '@/components/page-section'
import { useTeams } from '@/features/organization/hooks/use-teams'
import { useSaveItTeam } from '../hooks/use-websites'
import { ItDepartmentForm } from './it-department-form'

// Split out so only admins run the departments query; listTeams refuses everyone else.
export function ItDepartmentSection({ itTeamId }: { itTeamId: string }) {
  const teams = useTeams()
  const save = useSaveItTeam()
  const router = useRouter()

  return (
    <PageSection
      title="Who sees this page"
      description="Members of the IT department see the websites. Its lead runs the checks."
      maw={720}
    >
      <ItDepartmentForm
        itTeamId={itTeamId}
        teams={teams.data ?? []}
        teamsLoading={teams.isPending}
        onSave={async (values) => {
          await save.mutateAsync(values)
          // Who may check is decided on the server, so the page re-reads it.
          router.refresh()
        }}
      />
    </PageSection>
  )
}
