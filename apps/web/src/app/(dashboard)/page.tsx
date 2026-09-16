import { Badge, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { AttentionGrid } from '@/features/dashboard/components/attention-grid'
import { SummaryCard } from '@/features/dashboard/components/summary-card'
import { loadDashboardSummary } from '@/features/dashboard/service'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Dashboard' }

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export default async function DashboardPage() {
  const { user, session, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  const greetingName = profile.preferredName ?? profile.firstName ?? user.name
  const summary = await loadDashboardSummary()

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${greetingName}`}
        description={`${profile.jobTitle} · ${membership.team?.name ?? 'No department'}`}
      />

      <Stack gap="sm" component="section" aria-labelledby="attention-heading">
        <Title order={2} size="h4" id="attention-heading">
          Needs your attention
        </Title>
        <AttentionGrid summary={summary} />
      </Stack>

      <Stack gap="sm" component="section" aria-labelledby="account-heading">
        <Title order={2} size="h4" id="account-heading">
          Your account
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <SummaryCard title="Your role">
            <Text size="sm">{profile.jobTitle}</Text>
            <Text size="sm" c="dimmed">
              {profile.employmentType} in {membership.team?.name ?? 'no department'}
            </Text>
            {profile.employmentStatus ? (
              <Text size="sm" c="dimmed">
                {profile.employmentStatus}
              </Text>
            ) : null}
            {profile.startDate ? (
              <Text size="sm" c="dimmed">
                Started {dateOnly.format(profile.startDate)}
              </Text>
            ) : null}
          </SummaryCard>

          <SummaryCard
            title="Email"
            badge={
              user.emailVerified ? (
                <Badge color="green" variant="light">
                  Verified
                </Badge>
              ) : (
                <Badge color="yellow" variant="light">
                  Unverified
                </Badge>
              )
            }
          >
            <Text size="sm">{user.email}</Text>
            <Text size="sm" c="dimmed">
              {user.emailVerified
                ? 'This address receives portal notices.'
                : 'Check your inbox for the verification link.'}
            </Text>
          </SummaryCard>

          <SummaryCard title="IHP company ID">
            <Text size="sm" ff="monospace" fw={600}>
              {profile.ihpId ?? 'Not issued'}
            </Text>
            <Text size="sm" c="dimmed">
              Issued at setup and never reissued. Quote it when you contact People &amp; Culture.
            </Text>
          </SummaryCard>

          <SummaryCard title="Session">
            <Text size="sm">Expires {dateTime.format(new Date(session.expiresAt))}</Text>
            <Text size="sm" c="dimmed">
              You are signed out automatically when it lapses.
            </Text>
          </SummaryCard>
        </SimpleGrid>
      </Stack>
    </PageShell>
  )
}
