import { Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Settings' }

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

function text(value: string | null) {
  return value ?? 'Not provided'
}

function date(value: Date | null) {
  return value ? dateOnly.format(value) : 'Not provided'
}

export default async function SettingsPage() {
  const { user, profile } = await requireOnboarded()

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Settings
        </Title>
        <Text c="dimmed">
          The profile you completed at setup. Email People &amp; Culture to correct anything here.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" padding="lg">
          <Title order={2} size="h6" mb="sm">
            About you
          </Title>
          <Stack component="dl" gap="xs" m={0}>
            <Row label="Legal name" value={user.name} />
            <Row label="Preferred name" value={text(profile.preferredName)} />
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={text(profile.phone)} />
            <Row label="Date of birth" value={date(profile.dateOfBirth)} />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Title order={2} size="h6" mb="sm">
            Your role
          </Title>
          <Stack component="dl" gap="xs" m={0}>
            <Row label="Position" value={text(profile.jobTitle)} />
            <Row label="Department" value={text(profile.department)} />
            <Row label="Employment type" value={text(profile.employmentType)} />
            <Row label="Start date" value={date(profile.startDate)} />
            <Row label="Employee ID" value={text(profile.employeeId)} />
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Group gap="xs" align="baseline" wrap="wrap">
      <Text component="dt" size="sm" c="dimmed" miw={150}>
        {label}
      </Text>
      <Text component="dd" size="sm" m={0}>
        {value}
      </Text>
    </Group>
  )
}
