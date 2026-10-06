import { Stack } from '@mantine/core'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { PageShell } from '@/components/page-shell'
import { LeaveYearNav } from '@/features/leave/components/leave-year-nav'
import { MyLeaveBalances } from '@/features/leave/components/my-leave-balances'
import { TeamLeavePanel } from '@/features/leave/components/team-leave-panel'
import { leaveQuerySchema } from '@/features/leave/schema'
import { leaveYearFor } from '@/features/leave/service'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { breadcrumbsFor } from '@/lib/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Leave' }

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireOnboarded()
  const isAdmin = canManageOrganization(membershipOf(session.profile))
  const year = await leaveYearFor(leaveQuerySchema.parse(await searchParams).year)

  return (
    <PageShell>
      <PageHeader
        title="Leave"
        description="Working days left on each kind of leave. Weekends and holidays on your shift never count, and every allowance starts again on January 1."
        breadcrumbs={breadcrumbsFor(routes.attendanceLeave)}
      />
      <LeaveYearNav year={year} pathname={routes.attendanceLeave} />
      <Stack gap="xl">
        <PageSection
          title="My leave"
          description="Approved days are used; requests still waiting are shown beside them."
        >
          <MyLeaveBalances year={year} />
        </PageSection>
        {isAdmin ? (
          <PageSection
            title="Everyone’s leave"
            description="Change one person’s allowance with the pencil; everyone else keeps the form’s number."
          >
            <TeamLeavePanel year={year} />
          </PageSection>
        ) : null}
      </Stack>
    </PageShell>
  )
}
