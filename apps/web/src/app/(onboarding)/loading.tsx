import { Paper, Skeleton, Stack } from '@mantine/core'

// Same box sizes as the stepper card so nothing shifts when the profile lands.
export default function OnboardingLoading() {
  return (
    <Paper withBorder radius="md" p="xl" aria-busy="true">
      <Stack gap="lg">
        <Skeleton height={28} width="16rem" />
        <Skeleton height={20} width="22rem" />
        <Skeleton height={56} radius="md" />
        <Stack gap="md">
          <Skeleton height={58} radius="md" />
          <Skeleton height={58} radius="md" />
          <Skeleton height={58} radius="md" />
        </Stack>
        <Skeleton height={36} width="10rem" radius="md" />
      </Stack>
    </Paper>
  )
}
