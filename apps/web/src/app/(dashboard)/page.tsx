import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { AttentionGrid } from '@/features/dashboard/components/attention-grid'
import { ProfileCard } from '@/features/dashboard/components/profile-card'
import { VerifiedBadge } from '@/features/dashboard/components/verified-badge'
import { loadDashboardSummary } from '@/features/dashboard/service'
import { FirstDaysChecklist } from '@/features/new-hires/components/first-days-checklist'
import { loadChecklistFor } from '@/features/new-hires/service'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Dashboard' }

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export default async function DashboardPage() {
  const { user, session, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  const greetingName = profile.preferredName ?? profile.firstName ?? user.name
  const [summary, checklist] = await Promise.all([
    loadDashboardSummary(),
    membership.organizationId ? loadChecklistFor(membership.organizationId, user.id) : null,
  ])

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${greetingName}`}
        description={`${profile.jobTitle} · ${membership.team?.name ?? 'No department'}`}
      />

      {/* A finished checklist leaves the dashboard; the hire saw it complete when it happened. */}
      {checklist && !checklist.completedAt ? <FirstDaysChecklist initial={checklist} /> : null}

      <Stack gap="sm" component="section" aria-labelledby="attention-heading">
        <Title order={2} size="h4" id="attention-heading">
          Needs your attention
        </Title>
        <AttentionGrid summary={summary} />
      </Stack>

      <Stack gap="sm" component="section" aria-labelledby="profile-heading">
        <Title order={2} size="h4" id="profile-heading">
          Your profile
        </Title>
        <ProfileCard
          rows={[
            { label: 'Role', value: profile.jobTitle },
            {
              label: 'Department',
              value: `${membership.team?.name ?? 'No department'} · ${profile.employmentType}`,
            },
            ...(profile.employmentStatus
              ? [{ label: 'Status', value: profile.employmentStatus }]
              : []),
            ...(profile.startDate
              ? [{ label: 'Started', value: dateOnly.format(profile.startDate) }]
              : []),
            { label: 'Email', value: user.email },
            { label: 'Email status', value: <VerifiedBadge verified={user.emailVerified} /> },
            {
              label: 'IHP company ID',
              value: (
                <Text span inherit ff="monospace">
                  {profile.ihpId ?? 'Not issued'}
                </Text>
              ),
            },
            { label: 'Session expires', value: dateTime.format(new Date(session.expiresAt)) },
          ]}
          note={
            user.emailVerified
              ? undefined
              : 'Your email is not verified yet. Check your inbox for the verification link.'
          }
        />
      </Stack>
    </PageShell>
  )
}
