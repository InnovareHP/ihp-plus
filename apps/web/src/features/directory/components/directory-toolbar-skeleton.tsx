import { Group, Skeleton } from '@mantine/core'

// The search box and filter button's footprint, so the grid below does not jump when they render.
export function DirectoryToolbarSkeleton() {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" aria-hidden>
      <Skeleton h={36} w={280} maw="100%" />
      <Skeleton h={{ base: 44, sm: 36 }} w={{ base: '100%', sm: 96 }} />
    </Group>
  )
}
