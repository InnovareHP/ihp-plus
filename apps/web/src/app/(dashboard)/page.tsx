import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Dashboard' }

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export default async function DashboardPage() {
  const { user, session, profile } = await requireOnboarded()
  const greetingName = profile.preferredName ?? profile.firstName ?? user.name

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Welcome back, {greetingName}
        </Title>
        <Text c="dimmed">
          {profile.jobTitle} · {profile.department}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <SummaryCard title="Your role">
          <Text size="sm">{profile.jobTitle}</Text>
          <Text size="sm" c="dimmed">
            {profile.employmentType} in {profile.department}
          </Text>
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
  )
}

interface SummaryCardProps {
  title: string
  badge?: ReactNode
  children: ReactNode
}

function SummaryCard({ title, badge, children }: SummaryCardProps) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
        <Title order={2} size="h6">
          {title}
        </Title>
        {badge}
      </Group>
      <Stack gap={4}>{children}</Stack>
    </Card>
  )
}
