import { Skeleton, SimpleGrid, Stack } from '@mantine/core'

/** Holds the report's shape while GA4 answers, so nothing jumps when the numbers land. */
export function ReportSkeleton() {
  return (
    <Stack gap="xl" role="status" aria-busy="true" aria-label="Loading the report">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} height={110} radius="md" />
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <Skeleton height={290} radius="md" />
        <Skeleton height={290} radius="md" />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <Skeleton height={240} radius="md" />
        <Skeleton height={240} radius="md" />
      </SimpleGrid>
    </Stack>
  )
}
