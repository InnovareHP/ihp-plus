'use client'

import { Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { useExportMonth } from '../hooks/use-websites'
import { ChecklistPanel } from './checklist-panel'
import { ExportMonthForm } from './export-month-form'
import { ItDepartmentSection } from './it-department-section'

export interface WebsitesWorkspaceProps {
  canCheck: boolean
  canManage: boolean
  canConfigure: boolean
  itTeamId: string
  thisMonth: string
  userName: string
}

export function WebsitesWorkspace({
  canCheck,
  canManage,
  canConfigure,
  itTeamId,
  thisMonth,
  userName,
}: WebsitesWorkspaceProps) {
  const exportMonth = useExportMonth()

  return (
    <Stack gap="lg">
      {canConfigure ? <ItDepartmentSection itTeamId={itTeamId} /> : null}

      <PageSection
        title="Daily checklist"
        description="Every client website, checked when the IT lead clocks in and again when they clock out."
      >
        <ChecklistPanel canCheck={canCheck} canManage={canManage} userName={userName} />
      </PageSection>

      <PageSection
        title="Monthly report"
        description="Every website on every day of the month, both checks side by side, as a CSV."
        maw={720}
      >
        <ExportMonthForm
          thisMonth={thisMonth}
          onExport={async (month) => {
            await exportMonth.mutateAsync(month)
          }}
        />
      </PageSection>
    </Stack>
  )
}
