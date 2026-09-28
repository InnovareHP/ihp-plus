import { Skeleton, Stack } from '@mantine/core'

export default function CareersLoading() {
  return (
    <Stack gap="xl" maw={880} mx="auto" aria-busy="true">
      <Stack gap="xs">
        <Skeleton height={36} width="18rem" />
        <Skeleton height={20} width="32rem" maw="100%" />
      </Stack>
      <Stack gap="md">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={132} radius="md" />
        ))}
      </Stack>
    </Stack>
  )
}
