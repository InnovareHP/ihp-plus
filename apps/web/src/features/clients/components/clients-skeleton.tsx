import { Skeleton, Stack } from '@mantine/core'

// Mirrors the tabs row, the toolbar and the first rows, so nothing jumps when the table lands.
export function ClientsSkeleton() {
  return (
    <Stack gap="md" aria-busy="true">
      <Skeleton height={44} width="18rem" maw="100%" />
      <Skeleton height={36} />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
