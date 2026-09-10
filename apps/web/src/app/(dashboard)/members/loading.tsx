import { Skeleton, Stack } from '@mantine/core'

// Matches the members page heading and table so the layout does not move.
export default function MembersLoading() {
  return (
    <Stack gap="lg" aria-busy="true">
      <Stack gap={4}>
        <Skeleton height={32} width="10rem" />
        <Skeleton height={20} width="26rem" />
      </Stack>
      <Stack gap="xs">
        <Skeleton height={38} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Stack>
    </Stack>
  )
}
