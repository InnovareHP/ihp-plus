import { Paper, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { OnboardingStepper } from '@/features/onboarding/components/onboarding-stepper'
import { db } from '@ihp/db'
import { membershipOf, requireOnboarding } from '@/lib/auth-guard'
import { soleOrganizationId } from '@/lib/organization'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'

export const metadata: Metadata = { title: 'Finish your profile' }

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ''
}

export default async function OnboardingPage() {
  const { user, profile } = await requireOnboarding()

  // Outlook sign-in supplies one full name, which is the best first guess for the name fields.
  const [guessedFirst = '', ...guessedRest] = user.name.trim().split(/\s+/)

  const membership = membershipOf(profile)

  // Departments are the organization's teams. Scoped to the company the person is joining, so
  // a second organization in the database could never offer its departments here.
  const organizationId = membership.organizationId ?? (await soleOrganizationId())
  const teams = organizationId
    ? await db.team.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : []

  const photoUrl =
    profile.photoKey && isObjectStorageConfigured() ? await objectUrl(profile.photoKey) : undefined

  return (
    <Paper withBorder radius="md" p={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={1} size="h3">
            Finish your profile
          </Title>
          <Text size="sm" c="dimmed">
            Two short steps and the portal is yours. Your answers are visible in settings
            afterwards.
          </Text>
        </Stack>

        <OnboardingStepper
          userId={user.id}
          email={user.email}
          teams={teams.map((team) => ({ value: team.id, label: team.name }))}
          photoUrl={photoUrl}
          defaultValues={{
            firstName: profile.firstName ?? guessedFirst,
            middleInitial: profile.middleInitial ?? '',
            lastName: profile.lastName ?? guessedRest.join(' '),
            preferredName: profile.preferredName ?? '',
            phone: profile.phone ?? '',
            dateOfBirth: isoDate(profile.dateOfBirth),
            jobTitle: profile.jobTitle ?? '',
            employmentType: profile.employmentType ?? '',
            teamId: membership.team?.id ?? '',
            startDate: isoDate(profile.startDate),
            photoKey: profile.photoKey ?? '',
            confirmed: false,
          }}
        />
      </Stack>
    </Paper>
  )
}
