import { Avatar, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ContactDetailsForm } from '@/features/settings/components/contact-details-form'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'

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
  const membership = membershipOf(profile)
  const photoUrl =
    profile.photoKey && isObjectStorageConfigured() ? await objectUrl(profile.photoKey) : undefined

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Keep how colleagues reach you up to date. Your legal name, role and department come from People & Culture."
      />

      <Card padding="lg">
        <Group gap="lg" align="center" wrap="nowrap">
          <Avatar src={photoUrl} alt="" size={72} radius="md" color="brand">
            {initials(user.name)}
          </Avatar>
          <Stack gap={2}>
            <Text size="sm" c="dimmed">
              IHP company ID
            </Text>
            <Text size="xl" ff="monospace" fw={600}>
              {profile.ihpId ?? 'Not issued'}
            </Text>
            <Text size="xs" c="dimmed">
              This photo and ID are what your company ID card is printed from.
            </Text>
          </Stack>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card component="section" padding="lg" aria-labelledby="contact-heading">
          <Title order={2} size="h5" mb="sm" id="contact-heading">
            Contact details
          </Title>
          <ContactDetailsForm
            defaultValues={{
              preferredName: profile.preferredName ?? '',
              phone: profile.phone ?? '',
              photoKey: profile.photoKey ?? '',
            }}
            initialPhotoUrl={photoUrl}
            initials={initials(user.name)}
          />
        </Card>

        <Stack gap="md">
          <Card component="section" padding="lg">
            <Title order={2} size="h5" mb="sm">
              About you
            </Title>
            <Stack component="dl" gap="xs" m={0}>
              <Row label="Legal name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Date of birth" value={date(profile.dateOfBirth)} />
            </Stack>
          </Card>

          <Card component="section" padding="lg">
            <Title order={2} size="h5" mb="sm">
              Your role
            </Title>
            <Stack component="dl" gap="xs" m={0}>
              <Row label="Position" value={text(profile.jobTitle)} />
              <Row label="Department" value={membership.team?.name ?? 'Not provided'} />
              <Row label="Employment type" value={text(profile.employmentType)} />
              <Row label="Start date" value={date(profile.startDate)} />
            </Stack>
            <Text size="xs" c="dimmed" mt="sm">
              Email People &amp; Culture to correct anything in this section.
            </Text>
          </Card>
        </Stack>
      </SimpleGrid>
    </PageShell>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
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
