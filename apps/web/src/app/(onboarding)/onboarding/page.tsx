import { Paper, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { OnboardingStepper } from '@/features/onboarding/components/onboarding-stepper'
import { DEPARTMENTS, EMPLOYMENT_TYPES, POSITIONS } from '@/features/onboarding/options'
import { requireOnboarding } from '@/lib/auth-guard'
import { isObjectStorageConfigured, objectUrl } from '@/lib/s3'

export const metadata: Metadata = { title: 'Finish your profile' }

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ''
}

// A stored value that has since left the option list must not preselect a dead choice.
function option<T extends string>(options: readonly T[], value: string | null) {
  return options.find((candidate) => candidate === value)
}

export default async function OnboardingPage() {
  const { user, profile } = await requireOnboarding()

  // Outlook sign-in supplies one full name, which is the best first guess for the name fields.
  const [guessedFirst = '', ...guessedRest] = user.name.trim().split(/\s+/)

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
          email={user.email}
          photoUrl={photoUrl}
          defaultValues={{
            firstName: profile.firstName ?? guessedFirst,
            middleInitial: profile.middleInitial ?? '',
            lastName: profile.lastName ?? guessedRest.join(' '),
            preferredName: profile.preferredName ?? '',
            phone: profile.phone ?? '',
            dateOfBirth: isoDate(profile.dateOfBirth),
            jobTitle: option(POSITIONS, profile.jobTitle),
            department: option(DEPARTMENTS, profile.department),
            employmentType: option(EMPLOYMENT_TYPES, profile.employmentType),
            startDate: isoDate(profile.startDate),
            photoKey: profile.photoKey ?? '',
            confirmed: false,
          }}
        />
      </Stack>
    </Paper>
  )
}
